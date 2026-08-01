import { Server } from 'socket.io'
import { env, isAllowedOrigin } from '../config/env.js'
import { Room } from '../models/Room.js'
import { socketAuth } from './socketAuth.js'
import {
  handleConnect,
  handleDisconnect,
  resetPresence,
  sendPresenceSnapshot,
} from './handlers/presence.js'
import { registerMessageHandlers } from './handlers/message.js'
import { registerTypingHandlers } from './handlers/typing.js'
import { registerReadReceiptHandlers } from './handlers/readReceipt.js'
import { registerAiHandlers } from './handlers/ai.js'
import { registerNotesHandlers } from './handlers/notes.js'

export async function attachSocket(httpServer) {
  // CORS for Socket.io is configured separately from Express — a classic
  // half-hour of confusion if you only set it in one place. Both go through
  // `isAllowedOrigin` so they can never drift apart.
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    },
    pingTimeout: 30_000,
    maxHttpBufferSize: 1e6,
  })

  // A crash or redeploy leaves `isOnline: true` behind; start from a clean slate.
  await resetPresence()

  io.use(socketAuth)

  io.on('connection', (socket) => {
    /**
     * Listeners are attached synchronously, before any `await`. Socket.io does
     * not buffer inbound events for handlers that do not exist yet, so a client
     * that emits the instant `connect` fires would otherwise have its first
     * event silently dropped.
     */
    registerMessageHandlers(io, socket)
    registerTypingHandlers(io, socket)
    registerReadReceiptHandlers(io, socket)
    registerAiHandlers(io, socket)
    registerNotesHandlers(io, socket)

    socket.on('disconnect', () => {
      handleDisconnect(io, socket).catch((err) =>
        console.error('presence cleanup:', err.message),
      )
    })

    // Everything that needs the database happens after the wiring is in place.
    ;(async () => {
      await handleConnect(io, socket)

      // Join every room up front, not just the one on screen: unread badges for
      // the rooms you are *not* looking at depend on receiving their traffic.
      const rooms = await Room.find({ members: socket.user._id }).select('_id').lean()
      for (const room of rooms) socket.join(String(room._id))

      // Hand this socket an authoritative roster once it is fully wired up.
      sendPresenceSnapshot(socket)
    })().catch((err) => console.error('socket bootstrap:', err.message))
  })

  io.engine.on('connection_error', (err) => {
    if (env.isProd) return
    console.warn(`socket handshake rejected (${err.code}): ${err.message}`)
  })

  return io
}
