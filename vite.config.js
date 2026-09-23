import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only stand-in for public/api/catalog.php, which only runs on the host.
// It lists public/catalog-drop/<Chapter>/<Collection>/ in the same shape, so a
// photo dropped into that folder shows up under `npm run dev` exactly as one
// uploaded from the POS shows up on the live site. No resizing here.
function catalogDropDevApi() {
  const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
  const encode = (rel) => rel.split('/').map(encodeURIComponent).join('/')
  return {
    name: 'catalog-drop-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/catalog.php', (_req, res) => {
        const root = path.resolve(server.config.root, 'public', 'catalog-drop')
        const images = []
        const walk = (abs, rel, depth) => {
          if (depth > 3 || !fs.existsSync(abs)) return
          for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue
            const childRel = rel ? `${rel}/${entry.name}` : entry.name
            if (entry.isDirectory()) walk(path.join(abs, entry.name), childRel, depth + 1)
            else if (EXTS.has(path.extname(entry.name).toLowerCase()) && childRel.split('/').length === 3) {
              const url = '/catalog-drop/' + encode(childRel)
              images.push({ p: childRel, t: Math.floor(fs.statSync(path.join(abs, entry.name)).mtimeMs / 1000), thumb: url, full: url })
            }
          }
        }
        walk(root, '', 1)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true, engine: 'dev', count: images.length, images }))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), catalogDropDevApi()],
  server: { host: true },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom'] },
      },
    },
  },
})
