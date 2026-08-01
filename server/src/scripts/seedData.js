import { User } from '../models/User.js'
import { Room } from '../models/Room.js'
import { Message } from '../models/Message.js'
import { ensureBot, ensureAiRoomFor } from '../services/botService.js'

/**
 * Demo data, so a recruiter opening the live link lands in a populated app
 * rather than an empty one. Wipes and rebuilds — never point this at real data.
 */

export const DEMO_PASSWORD = 'pulsechat123'

export const DEMO_PEOPLE = [
  { name: 'Nadia Rahman', email: 'demo@pulsechat.app' },
  { name: 'Theo Marchetti', email: 'theo@pulsechat.app' },
  { name: 'Priya Nair', email: 'priya@pulsechat.app' },
  { name: 'Sam Okafor', email: 'sam@pulsechat.app' },
  { name: 'Lena Fischer', email: 'lena@pulsechat.app' },
]

const min = (n) => n * 60_000
const hr = (n) => n * 3_600_000
const ago = (ms) => new Date(Date.now() - ms)

export async function seedDatabase({ log = () => {} } = {}) {
  log('… clearing existing data')
  await Promise.all([User.deleteMany({}), Room.deleteMany({}), Message.deleteMany({})])

  const bot = await ensureBot()

  log('… creating users')
  // `create` in a loop, not `insertMany`, so the password-hashing hook runs.
  const users = {}
  for (const person of DEMO_PEOPLE) {
    const user = await User.create({ ...person, password: DEMO_PASSWORD })
    users[person.email.split('@')[0]] = user
  }

  const { demo, theo, priya, sam, lena } = users

  log('… creating rooms')
  const general = await Room.create({
    name: 'general',
    isGroup: true,
    members: [demo._id, theo._id, priya._id, sam._id, lena._id],
    admin: demo._id,
  })

  const shipRoom = await Room.create({
    name: 'ship-room',
    isGroup: true,
    members: [demo._id, theo._id, lena._id],
    admin: theo._id,
  })

  const notesRoom = await Room.create({
    name: 'sprint-notes',
    isGroup: true,
    members: [demo._id, theo._id, priya._id, sam._id],
    admin: priya._id,
  })

  const dmTheo = await Room.create({
    isGroup: false,
    members: [demo._id, theo._id],
    admin: demo._id,
  })

  const dmPriya = await Room.create({
    isGroup: false,
    members: [demo._id, priya._id],
    admin: demo._id,
  })

  for (const user of Object.values(users)) await ensureAiRoomFor(user._id)
  const aiRoom = await Room.findOne({ isAiRoom: true, members: demo._id })

  log('… writing messages')
  const script = [
    [general, priya, 'Morning all — presence tracking is live on staging 🎉', hr(4)],
    [general, theo, 'Nice. Did multi-tab break it again?', hr(4) - min(3)],
    [
      general,
      priya,
      'Nope. Sockets are tracked per user in a Map now, so we only flip someone offline on the last disconnect.',
      hr(4) - min(5),
    ],
    [general, demo, 'That was the whole bug. Green dots finally behave.', hr(4) - min(7)],
    [general, theo, '@ai explain what a WebSocket handshake actually is', min(9)],
    [
      general,
      bot,
      "A WebSocket connection starts life as an ordinary HTTP request.\n\n1. The client sends `GET /socket.io/` with `Upgrade: websocket` and a random `Sec-WebSocket-Key`.\n2. The server answers `101 Switching Protocols` and echoes back a hashed accept key.\n3. From that moment the same TCP socket carries **frames** in both directions — no more request/response.\n\nThat handshake is also where you authenticate:\n\n```js\nio.use((socket, next) => {\n  const { token } = socket.handshake.auth\n  try {\n    socket.user = jwt.verify(token, process.env.JWT_SECRET)\n    next()\n  } catch {\n    next(new Error('Unauthorized'))\n  }\n})\n```\n\nBecause it runs once per connection, every later event on that socket is already tied to a real user.",
      min(8),
      true,
    ],
    [general, sam, 'Saving that one for the interview 😅', min(4)],

    [shipRoom, theo, 'Render deploy is green. WebSockets held through the restart.', hr(1)],
    [
      shipRoom,
      lena,
      'Atlas indexes are in too — history pagination went from 400ms to 12ms.',
      min(52),
    ],

    [notesRoom, priya, "Dropped this week's scope in the shared notes doc.", hr(9)],

    [dmTheo, theo, 'Can you look at the typing debounce? It fires on every keystroke.', min(14)],
    [
      dmTheo,
      demo,
      'On it — emitting once on the first key, then stop_typing after 1.4s idle.',
      min(12),
    ],
    [dmTheo, theo, 'Perfect. Ship it.', min(11)],

    [dmPriya, priya, 'Design review at 4? I want to go through the empty states.', hr(3)],
    [dmPriya, demo, 'Works for me.', hr(3) - min(2)],

    [aiRoom, demo, 'Give me a one-paragraph pitch for this project I can put on my CV.', min(22)],
    [
      aiRoom,
      bot,
      'Here is a tight one:\n\n> **PulseChat** — a real-time messaging platform built on React, Node and Socket.io, with JWT-authenticated WebSocket handshakes, live presence across multiple tabs, typing indicators and read receipts. Includes an LLM assistant whose replies stream token-by-token over the socket, with the provider key held server-side behind per-user rate limiting.\n\nLead with *streaming* and *socket auth* — those are the two lines an interviewer will stop on.',
      min(21),
      true,
    ],
  ]

  for (const [room, sender, content, offset, isAi = false] of script) {
    const createdAt = ago(offset)
    const message = await Message.create({
      room: room._id,
      sender: sender._id,
      content,
      isAi,
      readBy: [sender._id],
      createdAt,
      updatedAt: createdAt,
    })
    await Room.findByIdAndUpdate(room._id, { lastMessage: message._id, updatedAt: createdAt })
  }

  return {
    users: DEMO_PEOPLE.length,
    rooms: await Room.countDocuments(),
    messages: await Message.countDocuments(),
  }
}

export function demoAccountsBanner() {
  return `  Sign in with any of these — password: ${DEMO_PASSWORD}\n${DEMO_PEOPLE.map(
    (p) => `    ${p.email}`,
  ).join('\n')}`
}
