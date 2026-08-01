/**
 * The whole backend against a throwaway in-memory MongoDB, seeded with demo
 * data — for working on the app before an Atlas cluster exists.
 *
 *   npm run start:local
 *
 * Nothing is persisted: stop the process and the database is gone. Use
 * `npm run start:dev` once MONGO_URI points at Atlas.
 */
import http from 'node:http'

process.env.NODE_ENV ||= 'development'
process.env.JWT_SECRET ||= 'local-development-secret-not-for-production-use'

const { MongoMemoryServer } = await import('mongodb-memory-server')

console.log('… starting an in-memory MongoDB (first run downloads the binary)')
const mongo = await MongoMemoryServer.create()
process.env.MONGO_URI = mongo.getUri('pulsechat')

const { env } = await import('../config/env.js')
const { connectDb, disconnectDb } = await import('../config/db.js')
const { createApp } = await import('../app.js')
const { attachSocket } = await import('../socket/index.js')
const { aiConfigured, aiUnavailableReason } = await import('../services/aiService.js')
const { seedDatabase, demoAccountsBanner } = await import('./seedData.js')

await connectDb()
const counts = await seedDatabase({ log: console.log })

const app = createApp()
const server = http.createServer(app)
const io = await attachSocket(server)
app.set('io', io)

server.listen(env.port, () => {
  console.log(`
  PulseChat API — LOCAL (in-memory database, nothing persists)
  ──────────────────────────────────────────────────────────────
  REST      http://localhost:${env.port}/api
  Socket    ws://localhost:${env.port}
  Origins   ${env.clientOrigins.join(', ')}
  Seeded    ${counts.users} users · ${counts.rooms} rooms · ${counts.messages} messages
  Assistant ${aiConfigured() ? env.ai.provider : 'not configured'}
  ──────────────────────────────────────────────────────────────

${demoAccountsBanner()}

  In client/.env set VITE_DEMO_MODE=false to talk to this server.
`)

  if (!aiConfigured()) console.warn(`  ⚠ ${aiUnavailableReason()}\n`)
})

async function shutdown() {
  console.log('\nShutting down the local stack.')
  await new Promise((resolve) => io.close(resolve))
  server.closeAllConnections?.()
  await new Promise((resolve) => server.close(resolve))
  await disconnectDb().catch(() => {})
  await mongo.stop().catch(() => {})
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
