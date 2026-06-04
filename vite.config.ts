import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { YoutubeTranscript } from 'youtube-transcript'

interface DeepSeekChoice {
  message: { content: string }
}
interface DeepSeekResponse {
  choices: DeepSeekChoice[]
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
                  model: 'deepseek-chat',
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
                  model: 'deepseek-chat',
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
      // {
      //   name: 'azure-translator-dev-proxy-deferred',
      //   configureServer(server) {
      //     server.middlewares.use('/api/translate', async (req, res) => { ... });
      //     server.middlewares.use('/api/dictionary-lookup', async (req, res) => { ... });
      //   },
      // },
    ],
  }
})
