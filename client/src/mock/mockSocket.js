import { EMIT, ON, AI_TRIGGER } from '@/utils/constants'
import { db, insertMessage, roomById } from './store'

const ANSWERS = [
  {
    match: /socket|websocket|realtime|real-time/i,
    text: `Socket.io sits on top of WebSockets and adds the things you actually need in production: automatic reconnection, rooms, and a fallback transport.\n\nThe shape you want is:\n\n\`\`\`js\nio.on('connection', (socket) => {\n  socket.join(roomId)\n  socket.on('send_message', async (payload) => {\n    const saved = await Message.create({ ...payload, sender: socket.user.id })\n    io.to(payload.roomId).emit('receive_message', saved)\n  })\n})\n\`\`\`\n\nTwo rules worth repeating in an interview:\n\n- **Derive the sender from \`socket.user\`**, never from the payload.\n- **Load history over REST, stream new messages over the socket** — paging through a socket gets messy fast.`,
  },
  {
    match: /jwt|auth|token|login|password/i,
    text: `Keep one source of truth for identity and reuse it on both transports.\n\n| Layer | How the token travels |\n| --- | --- |\n| REST | \`Authorization: Bearer <token>\` header |\n| Socket | \`io(url, { auth: { token } })\` handshake |\n\nOn the server, verify once in \`io.use()\` and hang the decoded user off the socket. After that every event on that connection is already authenticated — you never trust a client-sent user id.\n\nHash with **bcrypt**, set \`select: false\` on the password field, and keep the secret in \`.env\`.`,
  },
  {
    match: /mongo|schema|model|database|index/i,
    text: `For chat history the index is the whole game:\n\n\`\`\`js\nmessageSchema.index({ room: 1, createdAt: -1 })\n\`\`\`\n\nThat one line turns "give me the last 30 messages before this timestamp" into a range scan instead of a collection scan. Paginate with a **cursor** (\`createdAt < before\`) rather than \`skip\`, because \`skip\` gets slower the further back you go and it double-counts when new messages arrive mid-scroll.`,
  },
  {
    match: /react|frontend|component|state|ui/i,
    text: `Keep exactly one socket for the whole app, created in a context provider and shared through a hook.\n\n- **Connect after login, disconnect on logout.** A socket per component means a reconnect storm.\n- **Optimistic send:** render the bubble immediately with a temporary id, then reconcile when \`receive_message\` echoes back.\n- **Auto-scroll only when the user is already at the bottom** — nothing is more annoying than being yanked down mid-scroll.`,
  },
  {
    match: /deploy|host|render|vercel|production/i,
    text: `Split it three ways:\n\n1. **Client → Vercel or Netlify.** Static build, instant rollbacks.\n2. **Server → Render or Railway.** Both hold long-lived WebSocket connections; most serverless platforms do not.\n3. **Database → MongoDB Atlas**, free tier, IP allowlist set to your server.\n\nThe gotcha people hit: CORS for Socket.io is configured **separately** from Express — you need \`cors: { origin: CLIENT_URL }\` in the \`io\` options too.`,
  },
]

const FALLBACK = `Good question. Here is how I would approach it:\n\n- Start with the smallest version that works end to end, then make it good.\n- Write down the data shape before the UI — the schema is the contract everything else leans on.\n- Ship it somewhere public early, so "it works on my machine" never becomes the plan.\n\nAsk me something more specific and I can go deeper — architecture, a code review, or a bug you are stuck on.`

function answerFor(prompt) {
  const found = ANSWERS.find((a) => a.match.test(prompt))
  return found ? found.text : FALLBACK
}

/**
 * A drop-in fake for a socket.io client: same `on` / `off` / `emit` surface,
 * same event names as the blueprint's contract. It also keeps the room quietly
 * alive — presence flickers, someone starts typing — so the realtime layer is
 * visible without a server running.
 */
export function createMockSocket({ user }) {
  const listeners = new Map()
  const timers = new Set()
  let alive = true

  const on = (event, cb) => {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(cb)
    return socket
  }

  const off = (event, cb) => {
    if (!cb) listeners.delete(event)
    else listeners.get(event)?.delete(cb)
    return socket
  }

  const fire = (event, payload) => {
    if (!alive) return
    listeners.get(event)?.forEach((cb) => cb(payload))
  }

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (alive) fn()
    }, ms)
    timers.add(id)
    return id
  }

  async function streamAi(roomId, prompt) {
    fire(ON.aiTyping, { roomId })
    const body = answerFor(prompt)
    const chunks = body.match(/\S+\s*/g) || [body]

    await new Promise((r) => later(r, 620))

    let sent = 0
    for (const chunk of chunks) {
      if (!alive) return
      // Code fences arrive in a burst; prose trickles, like a real provider.
      await new Promise((r) => later(r, chunk.includes('`') ? 6 : 16 + Math.random() * 26))
      fire(ON.aiStream, { roomId, chunk })
      sent += 1
      if (sent > 400) break
    }

    const message = insertMessage({ room: roomId, senderId: db.botId, content: body, isAi: true })
    fire(ON.aiDone, { message })
  }

  const handlers = {
    [EMIT.joinRoom]: () => {},

    [EMIT.sendMessage]: ({ roomId, content, type = 'text', fileName, tempId }) => {
      later(() => {
        const saved = insertMessage({
          room: roomId,
          senderId: user._id,
          content,
          type,
          fileName,
        })
        fire(ON.receiveMessage, { message: { ...saved, tempId } })

        const room = roomById(roomId)
        const asksAi =
          room?.isAiRoom || String(content).trim().toLowerCase().startsWith(AI_TRIGGER)
        if (asksAi && type === 'text') {
          const prompt = String(content).replace(new RegExp(`^${AI_TRIGGER}`, 'i'), '').trim()
          streamAi(roomId, prompt || content)
        }
      }, 140)
    },

    [EMIT.aiMessage]: ({ roomId, prompt }) => streamAi(roomId, prompt),

    [EMIT.typing]: () => {},
    [EMIT.stopTyping]: () => {},

    [EMIT.markRead]: ({ messageId }) => {
      later(() => fire(ON.messageRead, { messageId, userId: 'u_theo' }), 900)
    },
  }

  const socket = {
    connected: true,
    id: 'demo-socket',
    auth: {},
    on,
    off,
    once: (event, cb) => {
      const wrapped = (payload) => {
        off(event, wrapped)
        cb(payload)
      }
      return on(event, wrapped)
    },
    emit: (event, payload) => {
      handlers[event]?.(payload || {})
      return socket
    },
    connect: () => socket,
    disconnect: () => {
      alive = false
      socket.connected = false
      timers.forEach(clearTimeout)
      timers.clear()
      listeners.clear()
      return socket
    },
  }

  // ── ambient life ────────────────────────────────────────────────
  later(() => fire('connect'), 60)
  later(() => fire(ON.presence, { onlineUserIds: ['u_theo', 'u_priya', db.botId, user._id] }), 120)

  // Someone drops in a few seconds after you arrive.
  later(() => {
    fire(ON.typing, { roomId: 'r_general', user: db.byId.u_priya })
    later(() => {
      fire(ON.stopTyping, { roomId: 'r_general', user: db.byId.u_priya })
      const saved = insertMessage({
        room: 'r_general',
        senderId: 'u_priya',
        content: 'Read receipts just landed on main — double ticks should be live for everyone.',
      })
      fire(ON.receiveMessage, { message: saved })
    }, 3200)
  }, 16_000)

  // Presence drifts, so the green dots are not static decoration.
  const pulse = setInterval(() => {
    if (!alive) return clearInterval(pulse)
    const roster = ['u_theo', 'u_priya', db.botId, user._id]
    if (Math.random() > 0.5) roster.push('u_sam')
    if (Math.random() > 0.7) roster.push('u_lena')
    fire(ON.presence, { onlineUserIds: roster })
  }, 14_000)

  return socket
}
