import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Dev-only: lets the page save a rendered share image to public/og.png. */
function saveOgImage(): Plugin {
  return {
    name: 'needle-save-og',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/save-og', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString()
          const m = body.match(/^data:image\/png;base64,(.+)$/)
          if (!m) {
            res.statusCode = 400
            return res.end('expected a PNG data URL')
          }
          writeFileSync(resolve(process.cwd(), 'public/og.png'), Buffer.from(m[1], 'base64'))
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), saveOgImage()],
  server: { port: 5190 },
  build: { chunkSizeWarningLimit: 2000 },
})
