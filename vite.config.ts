import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { YoutubeTranscript } from 'youtube-transcript'

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
  choices: DeepSeekChoice[]
  usage?: DeepSeekUsage
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
          // ─── POST /api/translate ─────────────────────────────────────────────
          server.middlewares.use('/api/translate', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.DEEPSEEK_API_KEY

              if (!apiKey) {
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

              const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'deepseek-v4-flash',
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

              // Runtime usage logging
              if (deepseekData.usage) {
                const { prompt_tokens, completion_tokens, total_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens } = deepseekData.usage
                console.log(`[DeepSeek Translate] tokens: ${total_tokens} (prompt: ${prompt_tokens}, completion: ${completion_tokens})`)
                if (prompt_cache_hit_tokens !== undefined) {
                  console.log(`[DeepSeek Translate] cache hit: ${prompt_cache_hit_tokens}, cache miss: ${prompt_cache_miss_tokens ?? 0}`)
                }
              }

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify([{
                translations: [{ text: translatedText }],
                detectedLanguage: { language: from || 'en', score: 1.0 },
              }]))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({
                error: {
                  code: 500,
                  message: error instanceof Error ? error.message : 'Unknown error',
                },
              }))
            }
          })

          // ─── POST /api/dictionary-lookup ────────────────────────────────────
          server.middlewares.use('/api/dictionary-lookup', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.DEEPSEEK_API_KEY

              if (!apiKey) {
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

Respond with a valid JSON array (no markdown, no code fences) in this exact format:
[
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

Include multiple translations for different meanings. Sort by confidence descending.`

              const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'deepseek-v4-flash',
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

              // Runtime usage logging
              if (deepseekData.usage) {
                const { prompt_tokens, completion_tokens, total_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens } = deepseekData.usage
                console.log(`[DeepSeek Dictionary] tokens: ${total_tokens} (prompt: ${prompt_tokens}, completion: ${completion_tokens})`)
                if (prompt_cache_hit_tokens !== undefined) {
                  console.log(`[DeepSeek Dictionary] cache hit: ${prompt_cache_hit_tokens}, cache miss: ${prompt_cache_miss_tokens ?? 0}`)
                }
              }

              // Parse the JSON response from DeepSeek
              let translations: unknown[]
              try {
                // Try direct parse first
                translations = JSON.parse(content)
              } catch {
                // Try to extract JSON from markdown code fences
                const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
                if (jsonMatch) {
                  translations = JSON.parse(jsonMatch[1].trim())
                } else {
                  throw new Error('Failed to parse DeepSeek dictionary response as JSON')
                }
              }

              if (!Array.isArray(translations)) {
                throw new Error('DeepSeek dictionary response is not an array')
              }

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify([{
                normalizedSource: word.toLowerCase(),
                displaySource: word,
                translations,
              }]))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({
                error: {
                  code: 500,
                  message: error instanceof Error ? error.message : 'Unknown error',
                },
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
          server.middlewares.use('/api/translate/azure-deferred', async (_req, res) => {
            res.statusCode = 503
            res.end(JSON.stringify({
              error: {
                code: 503,
                message: 'Azure Translator is deferred. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT in .env.local and re-enable this plugin.',
              },
            }))
          })
          server.middlewares.use('/api/dictionary-lookup/azure-deferred', async (_req, res) => {
            res.statusCode = 503
            res.end(JSON.stringify({
              error: {
                code: 503,
                message: 'Azure Translator is deferred. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT in .env.local and re-enable this plugin.',
              },
            }))
          })
        },
      },
      // ─── POST /api/sense-block ─────────────────────────────────────────────
      {
        name: 'sense-block-dev-proxy',
        configureServer(server) {
          server.middlewares.use('/api/sense-block', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const apiKey = env.DEEPSEEK_API_KEY

              if (!apiKey) {
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

              const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'deepseek-v4-flash',
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
                res.statusCode = deepseekRes.status
                res.end(JSON.stringify({
                  error: { code: deepseekRes.status, message: `DeepSeek API error: ${errorText}` },
                }))
                return
              }

              const deepseekData = await deepseekRes.json() as DeepSeekResponse
              const content = deepseekData.choices?.[0]?.message?.content?.trim() ?? ''

              // Runtime usage logging
              if (deepseekData.usage) {
                const { prompt_tokens, completion_tokens, total_tokens, prompt_cache_hit_tokens, prompt_cache_miss_tokens } = deepseekData.usage
                console.log(`[DeepSeek SenseBlock] tokens: ${total_tokens} (prompt: ${prompt_tokens}, completion: ${completion_tokens})`)
                if (prompt_cache_hit_tokens !== undefined) {
                  console.log(`[DeepSeek SenseBlock] cache hit: ${prompt_cache_hit_tokens}, cache miss: ${prompt_cache_miss_tokens ?? 0}`)
                }
              }

              let senseBlock: Record<string, string>
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

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify(senseBlock))
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
