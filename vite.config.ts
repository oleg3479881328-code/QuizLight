import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { YoutubeTranscript } from 'youtube-transcript'

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
        name: 'azure-translator-dev-proxy',
        configureServer(server) {
          // ─── POST /api/translate ─────────────────────────────────────────────
          server.middlewares.use('/api/translate', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: { code: 405, message: 'Method not allowed' } }))
              return
            }

            try {
              const endpoint = env.AZURE_TRANSLATOR_ENDPOINT
              const key = env.AZURE_TRANSLATOR_KEY
              const region = env.AZURE_TRANSLATOR_REGION

              if (!endpoint || !key || !region) {
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'Azure Translator not configured. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT in .env.local',
                  },
                }))
                return
              }

              const url = new URL(req.url ?? '/', 'http://localhost')
              const apiVersion = url.searchParams.get('api-version') || '3.0'
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

              // Build Azure URL
              const azureUrl = new URL(`${endpoint.replace(/\/+$/, '')}/translate`)
              azureUrl.searchParams.set('api-version', apiVersion)
              azureUrl.searchParams.set('to', to)
              if (from) {
                azureUrl.searchParams.set('from', from)
              }

              const azureRes = await fetch(azureUrl.toString(), {
                method: 'POST',
                headers: {
                  'Ocp-Apim-Subscription-Key': key,
                  'Ocp-Apim-Subscription-Region': region,
                  'Content-Type': 'application/json',
                },
                body,
              })

              const azureData = await azureRes.json()

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.statusCode = azureRes.status
              res.end(JSON.stringify(azureData))
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
              const endpoint = env.AZURE_TRANSLATOR_ENDPOINT
              const key = env.AZURE_TRANSLATOR_KEY
              const region = env.AZURE_TRANSLATOR_REGION

              if (!endpoint || !key || !region) {
                res.statusCode = 503
                res.end(JSON.stringify({
                  error: {
                    code: 503,
                    message: 'Azure Translator not configured. Set AZURE_TRANSLATOR_KEY, AZURE_TRANSLATOR_REGION, and AZURE_TRANSLATOR_ENDPOINT in .env.local',
                  },
                }))
                return
              }

              const url = new URL(req.url ?? '/', 'http://localhost')
              const apiVersion = url.searchParams.get('api-version') || '3.0'
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

              // Validate word is a single short token for dictionary
              const word = parsedBody[0].Text.trim()
              if (word.split(/\s+/).length > 1 || word.length > 50) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: { code: 400, message: 'Dictionary lookup supports single words only' } }))
                return
              }

              // Build Azure URL
              const azureUrl = new URL(`${endpoint.replace(/\/+$/, '')}/dictionary/lookup`)
              azureUrl.searchParams.set('api-version', apiVersion)
              azureUrl.searchParams.set('from', from)
              azureUrl.searchParams.set('to', to)

              const azureRes = await fetch(azureUrl.toString(), {
                method: 'POST',
                headers: {
                  'Ocp-Apim-Subscription-Key': key,
                  'Ocp-Apim-Subscription-Region': region,
                  'Content-Type': 'application/json',
                },
                body,
              })

              const azureData = await azureRes.json()

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.statusCode = azureRes.status
              res.end(JSON.stringify(azureData))
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
    ],
  }
})
