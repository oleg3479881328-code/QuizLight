import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { YoutubeTranscript } from 'youtube-transcript'

export default defineConfig({
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
  ],
})
