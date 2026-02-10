import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './index'

console.log('Starting local API server...')

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Local API server running at http://localhost:${info.port}`)
})
