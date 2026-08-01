import http from 'node:http'
import { assertEnv, env } from './src/config/env.js'
import { connectDb, disconnectDb } from './src/config/db.js'
import { createApp } from './src/app.js'
import { attachSocket } from './src/socket/index.js'
import { ensureBot } from './src/services/botService.js'
import { aiConfigured, aiUnavailableReason } from './src/services/aiService.js'

assertEnv()

const app = createApp()
const server = http.createServer(app)
let io = null

/**
 * `server.listen` reports failures by emitting `error`, not by rejecting — so
 * `start().catch()` never sees them and Node prints a raw stack trace instead.
 * The two that actually happen in development deserve an answer, not a dump.
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n✖ Port ${env.port} is already in use.\n\n` +
        `  Something else is listening — usually another copy of this server\n` +
        `  left running in a different terminal.\n\n` +
        `  Find it:   npx kill-port ${env.port}\n` +
        `  Windows:   netstat -ano | findstr :${env.port}   then  taskkill /PID <pid> /F\n` +
        `  macOS/Linux: lsof -ti:${env.port} | xargs kill\n\n` +
        `  Or run this one elsewhere: PORT=5001 npm run start:dev\n`,
    )
  } else if (err.code === 'EACCES') {
    console.error(`\n✖ Not allowed to bind port ${env.port}. Ports below 1024 need elevation.\n`)
  } else {
    console.error('\n✖ Server error:', err.message, '\n')
  }
  process.exit(1)
})

async function start() {
  await connectDb()

  const bot = await ensureBot()
  io = await attachSocket(server)
  app.set('io', io)

  server.listen(env.port, () => {
    console.log(`
  PulseChat API
  ──────────────────────────────────────────────
  REST      http://localhost:${env.port}/api
  Socket    ws://localhost:${env.port}
  Origins   ${env.clientOrigins.join(', ')}
  Assistant ${bot.name} ${aiConfigured() ? `· ${env.ai.provider}` : '· not configured'}
  ──────────────────────────────────────────────`)

    if (!aiConfigured()) console.warn(`  ⚠ ${aiUnavailableReason()}\n`)
  })
}

start().catch((err) => {
  console.error('✖ Failed to start:', err.message)
  process.exit(1)
})

/**
 * Order matters: close Socket.io first so its disconnect handlers can finish
 * their presence writes, *then* drop the database connection. `server.close()`
 * on its own would wait forever on live WebSocket connections.
 */
async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down.`)

  const forced = setTimeout(() => process.exit(1), 10_000)
  forced.unref()

  try {
    if (io) await new Promise((resolve) => io.close(resolve))
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
    await disconnectDb()
    process.exit(0)
  } catch (err) {
    console.error('Shutdown error:', err.message)
    process.exit(1)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason))
