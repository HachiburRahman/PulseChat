/**
 * Seed data for demo mode. Mirrors the Mongoose shapes in the blueprint so the
 * UI never has to care whether it is talking to Express or to these fixtures.
 */

const min = (n) => n * 60_000
const hr = (n) => n * 3_600_000
const ago = (ms) => new Date(Date.now() - ms).toISOString()

export const BOT_ID = 'u_ai'
export const ME_ID = 'u_me'

export const users = [
  {
    _id: ME_ID,
    name: 'Hachibur Rahman',
    email: 'demo@pulsechat.app',
    avatarUrl: '',
    isBot: false,
    isOnline: true,
    lastSeen: ago(0),
  },
  {
    _id: 'u_theo',
    name: 'Theo Marchetti',
    email: 'theo@pulsechat.app',
    avatarUrl: '',
    isBot: false,
    isOnline: true,
    lastSeen: ago(0),
  },
  {
    _id: 'u_priya',
    name: 'Priya Nair',
    email: 'priya@pulsechat.app',
    avatarUrl: '',
    isBot: false,
    isOnline: true,
    lastSeen: ago(0),
  },
  {
    _id: 'u_sam',
    name: 'Sam Okafor',
    email: 'sam@pulsechat.app',
    avatarUrl: '',
    isBot: false,
    isOnline: false,
    lastSeen: ago(min(38)),
  },
  {
    _id: 'u_lena',
    name: 'Lena Fischer',
    email: 'lena@pulsechat.app',
    avatarUrl: '',
    isBot: false,
    isOnline: false,
    lastSeen: ago(hr(5)),
  },
  {
    _id: BOT_ID,
    name: 'Pulse AI',
    avatarUrl: '',
    isBot: true,
    isOnline: true,
    lastSeen: ago(0),
  },
]

export const byId = Object.fromEntries(users.map((u) => [u._id, u]))
const me = byId[ME_ID]

export const rooms = [
  {
    _id: 'r_general',
    name: 'general',
    isGroup: true,
    isAiRoom: false,
    members: [me, byId.u_theo, byId.u_priya, byId.u_sam, byId.u_lena],
    admin: ME_ID,
    updatedAt: ago(min(4)),
  },
  {
    _id: 'r_ship',
    name: 'ship-room',
    isGroup: true,
    isAiRoom: false,
    members: [me, byId.u_theo, byId.u_lena],
    admin: 'u_theo',
    updatedAt: ago(min(52)),
  },
  {
    _id: 'r_ai',
    name: 'Pulse AI',
    isGroup: false,
    isAiRoom: true,
    members: [me, byId[BOT_ID]],
    admin: ME_ID,
    updatedAt: ago(min(21)),
  },
  {
    _id: 'r_dm_theo',
    name: '',
    isGroup: false,
    isAiRoom: false,
    members: [me, byId.u_theo],
    admin: ME_ID,
    updatedAt: ago(min(11)),
  },
  {
    _id: 'r_dm_priya',
    name: '',
    isGroup: false,
    isAiRoom: false,
    members: [me, byId.u_priya],
    admin: ME_ID,
    updatedAt: ago(hr(3)),
  },
  {
    _id: 'r_notes',
    name: 'sprint-notes',
    isGroup: true,
    isAiRoom: false,
    members: [me, byId.u_theo, byId.u_priya, byId.u_sam],
    admin: 'u_priya',
    updatedAt: ago(hr(9)),
  },
]

let seq = 0
const msg = (room, senderId, content, offset, extra = {}) => ({
  _id: `m_${++seq}`,
  room,
  sender: byId[senderId],
  type: 'text',
  isAi: senderId === BOT_ID,
  content,
  readBy: [ME_ID],
  createdAt: ago(offset),
  ...extra,
})

export const messages = [
  // ── #general ────────────────────────────────────────────────────
  msg('r_general', 'u_priya', 'Morning all — presence tracking is live on staging 🎉', hr(4)),
  msg('r_general', 'u_theo', 'Nice. Did multi-tab break it again?', hr(4) - min(3)),
  msg(
    'r_general',
    'u_priya',
    'Nope. Sockets are tracked per user in a Map now, so we only flip someone offline on the last disconnect.',
    hr(4) - min(5),
  ),
  msg('r_general', ME_ID, 'That was the whole bug. Green dots finally behave.', hr(4) - min(7)),
  msg('r_general', 'u_theo', '@ai explain what a WebSocket handshake actually is', min(9)),
  msg(
    'r_general',
    BOT_ID,
    "A WebSocket connection starts life as an ordinary HTTP request.\n\n1. The client sends `GET /socket.io/` with `Upgrade: websocket` and a random `Sec-WebSocket-Key`.\n2. The server answers `101 Switching Protocols` and echoes back a hashed accept key.\n3. From that moment the same TCP socket carries **frames** in both directions — no more request/response.\n\nThat handshake is also where you authenticate:\n\n```js\nio.use((socket, next) => {\n  const { token } = socket.handshake.auth\n  try {\n    socket.user = jwt.verify(token, process.env.JWT_SECRET)\n    next()\n  } catch {\n    next(new Error('Unauthorized'))\n  }\n})\n```\n\nBecause it runs once per connection, every later event on that socket is already tied to a real user.",
    min(8),
  ),
  msg('r_general', 'u_sam', 'Saving that one for the interview 😅', min(4)),

  // ── #ship-room ──────────────────────────────────────────────────
  msg('r_ship', 'u_theo', 'Render deploy is green. WebSockets held through the restart.', hr(1)),
  msg('r_ship', 'u_lena', 'Atlas indexes are in too — history pagination went from 400ms to 12ms.', min(52)),

  // ── Pulse AI DM ─────────────────────────────────────────────────
  msg('r_ai', ME_ID, 'Give me a one-paragraph pitch for this project I can put on my CV.', min(22)),
  msg(
    'r_ai',
    BOT_ID,
    'Here is a tight one:\n\n> **PulseChat** — a real-time messaging platform built on React, Node and Socket.io, with JWT-authenticated WebSocket handshakes, live presence across multiple tabs, typing indicators and read receipts. Includes an LLM assistant whose replies stream token-by-token over the socket, with the provider key held server-side behind per-user rate limiting.\n\nLead with *streaming* and *socket auth* — those are the two lines an interviewer will stop on.',
    min(21),
  ),

  // ── DM: Theo ────────────────────────────────────────────────────
  msg('r_dm_theo', 'u_theo', 'Can you look at the typing debounce? It fires on every keystroke.', min(14)),
  msg('r_dm_theo', ME_ID, 'On it — emitting once on the first key, then stop_typing after 1.4s idle.', min(12)),
  msg('r_dm_theo', 'u_theo', 'Perfect. Ship it.', min(11)),

  // ── DM: Priya ───────────────────────────────────────────────────
  msg('r_dm_priya', 'u_priya', 'Design review at 4? I want to go through the empty states.', hr(3)),
  msg('r_dm_priya', ME_ID, 'Works for me.', hr(3) - min(2)),

  // ── #sprint-notes ───────────────────────────────────────────────
  msg('r_notes', 'u_priya', "Dropped this week's scope in the shared notes doc.", hr(9)),
]

/** Rooms the demo user has not opened yet. */
export const seedUnread = { r_general: 3, r_dm_theo: 1 }
