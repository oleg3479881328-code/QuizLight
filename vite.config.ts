import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { YoutubeTranscript } from 'youtube-transcript'
import fs from 'fs'
import path from 'path'

interface DeepSeekChoice {
  message: { content: string }
}
interface DeepSeekUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}
interface DeepSeekResponse {
  id?: string
  choices: DeepSeekChoice[]
  usage?: DeepSeekUsage
}

type RuntimeLogEntry = {
  provider: 'deepseek'
  model: string
  endpoint: string
  status: string
  latency_ms: number
  request_id?: string
  input_tokens_total?: number
  input_tokens_cache_hit?: number
  input_tokens_cache_miss?: number
  output_tokens?: number
  total_tokens?: number
}

/** Append a JSONL line to the runtime log file. */
function logJsonl(entry: RuntimeLogEntry) {
  const logDir = path.resolve(process.cwd(), 'logs')
  const logFile = path.join(logDir, 'deepseek-runtime.jsonl')
  try {
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(
      logFile,
      JSON.stringify({ timestamp_utc: new Date().toISOString(), ...entry }) + '\n',
      'utf-8',
    )
  } catch (error) {
    console.warn('[DeepSeek runtime log] Failed to append JSONL entry:', error)
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      {
        name: 'youtube-transcript-dev-proxy',
        configureServer(server) {
          server.middlewares.use('/api/youtube-transcript', async (req, res) => {
            try {
              const url = new URL(req.url ?? '/', 'http://localhost')
              const videoId = url.searchParams.get('videoId')

              if (!videoId) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing videoId' }))
                return
              }

              const transcript = await YoutubeTranscript.fetchTranscript(videoId)

              // Normalize timings: detect if offset is in milliseconds or seconds
              const normalized = transcript.map((entry) => {
                const shouldConvertFromMs = entry.offset > 1000 || entry.duration > 100
                const start = shouldConvertFromMs ? entry.offset / 1000 : entry.offset
                const duration = shouldConvertFromMs ? entry.duration / 1000 : entry.duration
                return { text: entry.text, start, end: start + duration }
              })

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(normalized))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
            }
          })
        },
      },
      {
        name: 'deepseek-dev-proxy',
        configureServer(server) {
          const deepseekBaseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
          const deepseekModel = env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

          function writeRuntimeLog(args: {
            endpoint: string
            status: string
            startedAt: number
            response?: DeepSeekResponse
          }) {
            const { endpoint, status, startedAt, response } = args
            logJsonl({
              provider: 'deepseek',
              model: deepseekModel,
              endpoint,
              status,
              latency_ms: Date.now() - startedAt,
              request_id: response?.id,
              input_tokens_total: response?.usage?.prompt_tokens,
              input_tokens_cache_hit: response?.usage?.prompt_cache_hit_tokens,
              input_tokens_cache_miss: response?.usage?.prompt_cache_miss_tokens,
              output_tokens: response?.usage?.completion_tokens,
              total_tokens: response?.usage?.total_tokens,
            })
          }

          // ─── Helper: register a route on both the provider-prefixed path and the alias ───
          function registerRoute(
            primaryPath: string,
            aliasPath: string | null,
            handler: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => Promise<void>,
          ) {

            server.middlewares.use(primaryPath, handler)
            if (aliasPath) {
              server.middlewares.use(aliasPath, handler)
            }
          }

          // ─── POST /api/deepseek/translate (primary) + /api/translate (alias) ──────────
          registerRoute('/api/deepseek/translate', '/api/translate', async (req, res) => {
            const startedAt = Date.now()
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.DEEPSEEK_API_KEY

              if (!apiKey) {
                writeRuntimeLog({
                  endpoint: '/api/deepseek/translate',
                  status: 'not_configured',
                  startedAt,
                })
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'DeepSeek not configured. Set DEEPSEEK_API_KEY in .env.local',
                  },
                }))
                return
              }

              const url = new URL(req.url ?? '/', 'http://localhost')
              const to = url.searchParams.get('to')
              const from = url.searchParams.get('from')

              if (!to) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Missing "to" language parameter' } }))
                return
              }

              // Validate languages: only en and ru for MVP
              if (!['en', 'ru'].includes(to)) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Only "en" and "ru" are supported for MVP' } }))
                return
              }
              if (from && !['en', 'ru'].includes(from)) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Only "en" and "ru" are supported for MVP' } }))
                return
              }

              // Read body
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const body = Buffer.concat(chunks).toString('utf-8')

              // Validate body is valid JSON
              let parsedBody: unknown
              try {
                parsedBody = JSON.parse(body)
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Invalid JSON body' } }))
                return
              }

              // Validate body structure
              if (!Array.isArray(parsedBody) || parsedBody.length === 0 || !parsedBody[0].Text || typeof parsedBody[0].Text !== 'string' || !parsedBody[0].Text.trim()) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Body must be [{Text: "non-empty string"}]' } }))
                return
              }

              const text = parsedBody[0].Text.trim()

              // Build language direction prompt
              const sourceLang = from === 'en' ? 'English' : 'Russian'
              const targetLang = to === 'en' ? 'English' : 'Russian'

              const systemPrompt = `You are a precise translator. Translate the following ${sourceLang} text to ${targetLang}. Respond with ONLY the translated text, no explanations, no quotes, no formatting.`
              const userPrompt = text

              const deepseekRes = await fetch(`${deepseekBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: deepseekModel,
                  thinking: { type: 'disabled' },
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                  ],
                  max_tokens: 500,
                  temperature: 0.3,
                }),
              })

              if (!deepseekRes.ok) {
                const errorText = await deepseekRes.text()
                writeRuntimeLog({
                  endpoint: '/api/deepseek/translate',
                  status: `http_${deepseekRes.status}`,
                  startedAt,
                })
                res.statusCode = deepseekRes.status
                res.end(JSON.stringify({
                  error: {
                    code: deepseekRes.status,
                    message: `DeepSeek API error: ${errorText}`,
                  },
                }))
                return
              }

              const deepseekData = await deepseekRes.json() as DeepSeekResponse
              const translatedText = deepseekData.choices?.[0]?.message?.content?.trim() ?? ''

              if (!translatedText) {
                writeRuntimeLog({
                  endpoint: '/api/deepseek/translate',
                  status: 'invalid_response',
                  startedAt,
                  response: deepseekData,
                })
                res.statusCode = 502
                res.end(JSON.stringify({
                  error: {
                    code: 502,
                    message: 'DeepSeek translate response was empty',
                  },
                }))
                return
              }

              writeRuntimeLog({
                endpoint: '/api/deepseek/translate',
                status: 'success',
                startedAt,
                response: deepseekData,
              })

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify([{
                translations: [{ text: translatedText }],
                detectedLanguage: { language: from || 'en', score: 1.0 },
              }]))
            } catch (error) {
              writeRuntimeLog({
                endpoint: '/api/deepseek/translate',
                status: 'exception',
                startedAt,
              })
              res.statusCode = 500
              res.end(JSON.stringify({
                error: {
                  code: 500,
                  message: error instanceof Error ? error.message : 'Unknown error',
                },
              }))
            }
          })

          // ─── POST /api/deepseek/dictionary-lookup (primary) + /api/dictionary-lookup (alias) ──
          registerRoute('/api/deepseek/dictionary-lookup', '/api/dictionary-lookup', async (req, res) => {
            const startedAt = Date.now()
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.DEEPSEEK_API_KEY

              if (!apiKey) {
                writeRuntimeLog({
                  endpoint: '/api/deepseek/dictionary-lookup',
                  status: 'not_configured',
                  startedAt,
                })
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'DeepSeek not configured. Set DEEPSEEK_API_KEY in .env.local',
                  },
                }))
                return
              }

              const url = new URL(req.url ?? '/', 'http://localhost')
              const from = url.searchParams.get('from')
              const to = url.searchParams.get('to')

              if (!from || !to) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Missing "from" or "to" language parameter' } }))
                return
              }

              // Dictionary lookup: only en -> ru for MVP
              if (from !== 'en' || to !== 'ru') {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Dictionary lookup only supports en -> ru for MVP' } }))
                return
              }

              // Read body
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const body = Buffer.concat(chunks).toString('utf-8')

              // Validate body is valid JSON
              let parsedBody: unknown
              try {
                parsedBody = JSON.parse(body)
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Invalid JSON body' } }))
                return
              }

              // Validate body structure
              if (!Array.isArray(parsedBody) || parsedBody.length === 0 || !parsedBody[0].Text || typeof parsedBody[0].Text !== 'string' || !parsedBody[0].Text.trim()) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Body must be [{Text: "non-empty string"}]' } }))
                return
              }

              const word = parsedBody[0].Text.trim()

              // Validate word is a single short token for dictionary
              if (word.split(/\s+/).length > 1 || word.length > 50) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Dictionary lookup supports single words only' } }))
                return
              }

              const systemPrompt = `You are a bilingual dictionary. For the given English word, provide Russian translations with parts of speech.

Respond with a valid JSON object (no markdown, no code fences) in this exact format:
{
  "translations": [
    {
      "normalizedTarget": "russian word (lowercase)",
      "displayTarget": "Russian word (normal form)",
      "posTag": "NOUN|VERB|ADJ|ADV|PRON|PREP|CONJ|INTJ|UNKNOWN",
      "confidence": 0.0-1.0,
      "prefixWord": "",
      "backTranslations": [
        { "normalizedText": "english back-translation", "displayText": "English back-translation", "numExamples": 0, "frequencyCount": 0 }
      ]
    }
  ]
}

Include multiple translations for different meanings. Sort by confidence descending.`

              const deepseekRes = await fetch(`${deepseekBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: deepseekModel,
                  thinking: { type: 'disabled' },
                  response_format: { type: 'json_object' },
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: word },
                  ],
                  max_tokens: 1000,
                  temperature: 0.3,
                }),
              })

              if (!deepseekRes.ok) {
                const errorText = await deepseekRes.text()
                writeRuntimeLog({
                  endpoint: '/api/deepseek/dictionary-lookup',
                  status: `http_${deepseekRes.status}`,
                  startedAt,
                })
                res.statusCode = deepseekRes.status
                res.end(JSON.stringify({
                  error: {
                    code: deepseekRes.status,
                    message: `DeepSeek API error: ${errorText}`,
                  },
                }))
                return
              }

              const deepseekData = await deepseekRes.json() as DeepSeekResponse
              const content = deepseekData.choices?.[0]?.message?.content?.trim() ?? ''

              // Parse the JSON response from DeepSeek
              let parsed: { translations?: unknown[] }
              try {
                parsed = JSON.parse(content)
              } catch {
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
                if (jsonMatch) {
                  parsed = JSON.parse(jsonMatch[1].trim())
                } else {
                  throw new Error('Failed to parse DeepSeek dictionary response as JSON')
                }
              }

              // Validate server-side: require { translations: [...] } wrapper
              if (!parsed || !Array.isArray(parsed.translations)) {
                throw new Error('DeepSeek dictionary response missing "translations" array')
              }

              // Validate each translation item has required fields and optional backTranslations shape
              const validatedTranslations = parsed.translations.flatMap((t: unknown) => {
                if (!t || typeof t !== 'object') return []
                const item = t as Record<string, unknown>
                const baseValid =
                  typeof item.normalizedTarget === 'string' &&
                  typeof item.displayTarget === 'string' &&
                  typeof item.posTag === 'string' &&
                  typeof item.confidence === 'number'

                if (!baseValid) {
                  return []
                }

                const validatedBackTranslations = Array.isArray(item.backTranslations)
                  ? item.backTranslations.filter((backTranslation) => {
                      if (!backTranslation || typeof backTranslation !== 'object') return false
                      const backItem = backTranslation as Record<string, unknown>
                      return (
                        typeof backItem.normalizedText === 'string' &&
                        typeof backItem.displayText === 'string' &&
                        typeof backItem.numExamples === 'number' &&
                        typeof backItem.frequencyCount === 'number'
                      )
                    })
                  : undefined

                return [
                  {
                    ...item,
                    backTranslations: validatedBackTranslations,
                  },
                ]
              })

              if (validatedTranslations.length === 0) {
                writeRuntimeLog({
                  endpoint: '/api/deepseek/dictionary-lookup',
                  status: 'invalid_response',
                  startedAt,
                  response: deepseekData,
                })
                res.statusCode = 502
                res.end(JSON.stringify({
                  error: {
                    code: 502,
                    message: 'DeepSeek dictionary response produced no valid translations',
                  },
                }))
                return
              }

              writeRuntimeLog({
                endpoint: '/api/deepseek/dictionary-lookup',
                status: 'success',
                startedAt,
                response: deepseekData,
              })

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify([{
                normalizedSource: word.toLowerCase(),
                displaySource: word,
                translations: validatedTranslations,
              }]))
            } catch (error) {
              writeRuntimeLog({
                endpoint: '/api/deepseek/dictionary-lookup',
                status: 'exception',
                startedAt,
              })
              res.statusCode = 500
              res.end(JSON.stringify({
                error: {
                  code: 500,
                  message: error instanceof Error ? error.message : 'Unknown error',
                },
              }))
            }
          })

          // ─── POST /api/deepseek/sense-block (primary) + /api/sense-block (alias) ──────────
          registerRoute('/api/deepseek/sense-block', '/api/sense-block', async (req, res) => {
            const startedAt = Date.now()
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.DEEPSEEK_API_KEY

              if (!apiKey) {
                writeRuntimeLog({
                  endpoint: '/api/deepseek/sense-block',
                  status: 'not_configured',
                  startedAt,
                })
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'DeepSeek not configured. Set DEEPSEEK_API_KEY in .env.local',
                  },
                }))
                return
              }

              // Read body
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const body = Buffer.concat(chunks).toString('utf-8')

              let parsedBody: { phrase: string; translation?: string; previousLines?: string; nextLines?: string }
              try {
                parsedBody = JSON.parse(body)
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Invalid JSON body' } }))
                return
              }

              if (!parsedBody.phrase || typeof parsedBody.phrase !== 'string') {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Body must include "phrase" (string)' } }))
                return
              }

              const systemPrompt = `You are a language learning assistant. Given an English phrase from a YouTube video, provide a sense block (context, meaning, usage) for the learner.

Respond with a valid JSON object (no markdown, no code fences) in this exact format:
{
  "situation": "brief description of when this phrase is used",
  "intent": "what the speaker intends to convey",
  "tone": "the emotional tone (e.g. neutral, formal, casual, excited)",
  "sense": "a clear explanation of the meaning in simple English",
  "usageNote": "any grammatical or cultural usage notes"
}`

              const userPrompt = JSON.stringify({
                phrase: parsedBody.phrase,
                translation: parsedBody.translation || '',
                previousLines: parsedBody.previousLines || '',
                nextLines: parsedBody.nextLines || '',
              })

              const deepseekRes = await fetch(`${deepseekBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: deepseekModel,
                  thinking: { type: 'disabled' },
                  response_format: { type: 'json_object' },
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                  ],
                  max_tokens: 500,
                  temperature: 0.3,
                }),
              })

              if (!deepseekRes.ok) {
                const errorText = await deepseekRes.text()
                writeRuntimeLog({
                  endpoint: '/api/deepseek/sense-block',
                  status: `http_${deepseekRes.status}`,
                  startedAt,
                })
                res.statusCode = deepseekRes.status
                res.end(JSON.stringify({
                  error: { code: deepseekRes.status, message: `DeepSeek API error: ${errorText}` },
                }))
                return
              }

              const deepseekData = await deepseekRes.json() as DeepSeekResponse
              const content = deepseekData.choices?.[0]?.message?.content?.trim() ?? ''

              let senseBlock: Record<string, unknown>
              try {
                senseBlock = JSON.parse(content)
              } catch {
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
                if (jsonMatch) {
                  senseBlock = JSON.parse(jsonMatch[1].trim())
                } else {
                  throw new Error('Failed to parse DeepSeek sense-block response as JSON')
                }
              }

              // Server-side validation: require all 5 string fields
              if (
                !senseBlock ||
                typeof senseBlock.situation !== 'string' ||
                typeof senseBlock.intent !== 'string' ||
                typeof senseBlock.tone !== 'string' ||
                typeof senseBlock.sense !== 'string' ||
                typeof senseBlock.usageNote !== 'string'
              ) {
                writeRuntimeLog({
                  endpoint: '/api/deepseek/sense-block',
                  status: 'invalid_response',
                  startedAt,
                  response: deepseekData,
                })
                res.statusCode = 502
                res.end(JSON.stringify({
                  error: {
                    code: 502,
                    message: 'DeepSeek sense-block response missing required string fields',
                  },
                }))
                return
              }

              writeRuntimeLog({
                endpoint: '/api/deepseek/sense-block',
                status: 'success',
                startedAt,
                response: deepseekData,
              })

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({
                situation: senseBlock.situation,
                intent: senseBlock.intent,
                tone: senseBlock.tone,
                sense: senseBlock.sense,
                usageNote: senseBlock.usageNote,
              }))
            } catch (error) {
              writeRuntimeLog({
                endpoint: '/api/deepseek/sense-block',
                status: 'exception',
                startedAt,
              })
              res.statusCode = 500
              res.end(JSON.stringify({
                error: { code: 500, message: error instanceof Error ? error.message : 'Unknown error' },
              }))
            }
          })
        },
      },
      // ─── Azure Translator (deferred compatibility) ─────────────────────────
      // Azure Translator code is preserved below but not active.
      // To re-enable: rename this plugin to 'azure-translator-dev-proxy' and
      // ensure it is registered before the deepseek-dev-proxy plugin.
      {
        name: 'azure-translator-dev-proxy-deferred',
        configureServer(server) {
          // ─── POST /api/translate/azure-deferred ─────────────────────────────
          server.middlewares.use('/api/translate/azure-deferred', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.AZURE_TRANSLATOR_KEY
              const region = env.AZURE_TRANSLATOR_REGION
              const endpoint = env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com'

              if (!apiKey || !region) {
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'Azure Translator not configured. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT in .env.local and re-enable this plugin.',
                  },
                }))
                return
              }

              const url = new URL(req.url ?? '/', 'http://localhost')
              const to = url.searchParams.get('to')
              const from = url.searchParams.get('from')

              if (!to) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Missing "to" language parameter' } }))
                return
              }

              // Read body
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const body = Buffer.concat(chunks).toString('utf-8')

              let parsedBody: unknown
              try {
                parsedBody = JSON.parse(body)
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Invalid JSON body' } }))
                return
              }

              if (!Array.isArray(parsedBody) || parsedBody.length === 0 || !parsedBody[0].Text || typeof parsedBody[0].Text !== 'string') {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Body must be [{Text: "string"}]' } }))
                return
              }

              const azureUrl = `${endpoint}/translate?api-version=3.0&to=${to}${from ? `&from=${from}` : ''}`
              const azureRes = await fetch(azureUrl, {
                method: 'POST',
                headers: {
                  'Ocp-Apim-Subscription-Key': apiKey,
                  'Ocp-Apim-Subscription-Region': region,
                  'Content-Type': 'application/json',
                },
                body,
              })

              if (!azureRes.ok) {
                const errorText = await azureRes.text()
                res.statusCode = azureRes.status
                res.end(JSON.stringify({
                  error: { code: azureRes.status, message: `Azure Translator API error: ${errorText}` },
                }))
                return
              }

              const azureData = await azureRes.json()
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(azureData))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({
                error: { code: 500, message: error instanceof Error ? error.message : 'Unknown error' },
              }))
            }
          })

          // ─── POST /api/dictionary-lookup/azure-deferred ─────────────────────
          server.middlewares.use('/api/dictionary-lookup/azure-deferred', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.AZURE_TRANSLATOR_KEY
              const region = env.AZURE_TRANSLATOR_REGION
              const endpoint = env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com'

              if (!apiKey || !region) {
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'Azure Translator not configured. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT in .env.local and re-enable this plugin.',
                  },
                }))
                return
              }

              const url = new URL(req.url ?? '/', 'http://localhost')
              const from = url.searchParams.get('from')
              const to = url.searchParams.get('to')

              if (!from || !to) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Missing "from" or "to" language parameter' } }))
                return
              }

              // Read body
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const body = Buffer.concat(chunks).toString('utf-8')

              let parsedBody: unknown
              try {
                parsedBody = JSON.parse(body)
              } catch {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Invalid JSON body' } }))
                return
              }

              if (!Array.isArray(parsedBody) || parsedBody.length === 0 || !parsedBody[0].Text || typeof parsedBody[0].Text !== 'string') {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Body must be [{Text: "string"}]' } }))
                return
              }

              const azureUrl = `${endpoint}/dictionary/lookup?api-version=3.0&from=${from}&to=${to}`
              const azureRes = await fetch(azureUrl, {
                method: 'POST',
                headers: {
                  'Ocp-Apim-Subscription-Key': apiKey,
                  'Ocp-Apim-Subscription-Region': region,
                  'Content-Type': 'application/json',
                },
                body,
              })

              if (!azureRes.ok) {
                const errorText = await azureRes.text()
                res.statusCode = azureRes.status
                res.end(JSON.stringify({
                  error: { code: azureRes.status, message: `Azure Dictionary API error: ${errorText}` },
                }))
                return
              }

              const azureData = await azureRes.json()
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(azureData))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({
                error: { code: 500, message: error instanceof Error ? error.message : 'Unknown error' },
              }))
            }
          })
        },
      },
    ],
  }
})
