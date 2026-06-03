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

            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(
              transcript.map((entry) => ({
                text: entry.text,
                start: entry.offset / 1000,
                end: (entry.offset + entry.duration) / 1000,
              })),
            ))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }))
          }
        })
      },
    },
  ],
})
