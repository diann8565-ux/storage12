import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app as apiApp } from './index'

const app = new Hono()

// 1. API Routes (mounts at /api because apiApp has basePath '/api')
app.route('/', apiApp)

// 2. Serve Static Files (Frontend)
app.use('/*', serveStatic({ root: './dist' }))

// 3. SPA Fallback (Always serve index.html for unknown routes)
app.use('*', serveStatic({ path: './dist/index.html' }))

const port = Number(process.env.PORT) || 3000
console.log(`Server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port
})