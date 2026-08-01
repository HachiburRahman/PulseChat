/**
 * End-to-end smoke test — boots the real app against an in-memory MongoDB and
 * drives it exactly the way the React client does: REST for auth and history,
 * a socket for everything live.
 *
 *   npm run smoke
 *
 * No Atlas connection and no AI key required.
 */
import assert from 'node:assert/strict'
import http from 'node:http'

// Every module reads config at import time, so the environment is set first and
// the app is pulled in dynamically below.
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'smoke-test-secret-that-is-definitely-long-enough'
process.env.CLIENT_URL = 'http://localhost:5173'
process.env.DISABLE_RATE_LIMIT = 'true'
process.env.GEMINI_API_KEY = ''
process.env.AI_PROVIDER = 'gemini'

const { MongoMemoryServer } = await import('mongodb-memory-server')
const { io: ioClient } = await import('socket.io-client')

let passed = 0
const failures = []

async function check(label, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  \x1b[32m✔\x1b[0m ${label}`)
  } catch (err) {
    failures.push({ label, err })
    console.log(`  \x1b[31m✖\x1b[0m ${label}\n      ${err.message}`)
  }
}

const section = (name) => console.log(`\n\x1b[1m${name}\x1b[0m`)

/** Records every payload for an event from the moment it is attached. */
function collect(socket, event) {
  const seen = []
  socket.on(event, (payload) => seen.push(payload))
  return seen
}

/** Resolves once `predicate` passes over the collected payloads. */
async function until(seen, predicate, { timeout = 8000, what = 'condition' } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const hit = seen.find(predicate)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** Resolves with the first matching event, or rejects on timeout. */
function once(socket, event, { timeout = 8000, where = event } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timed out waiting for "${where}"`))
    }, timeout)

    const handler = (payload) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })
}

const mongo = await MongoMemoryServer.create()
process.env.MONGO_URI = mongo.getUri('pulsechat_smoke')

const { connectDb, disconnectDb } = await import('../config/db.js')
const { createApp } = await import('../app.js')
const { attachSocket } = await import('../socket/index.js')
const { ensureBot } = await import('../services/botService.js')

await connectDb()
const bot = await ensureBot()

const app = createApp()
const server = http.createServer(app)
const io = await attachSocket(server)
await new Promise((resolve) => server.listen(0, resolve))

// A hung socket assertion should fail the run, not stall CI forever.
const watchdog = setTimeout(() => {
  console.error('\n✖ Smoke test exceeded 120s — aborting.')
  process.exit(1)
}, 120_000)
watchdog.unref()

const port = server.address().port
const API = `http://localhost:${port}/api`
const WS = `http://localhost:${port}`

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(API + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

console.log(`\nPulseChat API smoke test — in-memory Mongo on :${port}`)

/* ── REST: auth ─────────────────────────────────────────────────────── */
section('Auth')

let ada, grace

await check('POST /auth/register returns { token, user }', async () => {
  const res = await call('POST', '/auth/register', {
    body: { name: 'Ada Lovelace', email: 'ada@pulsechat.test', password: 'analytical1' },
  })
  assert.equal(res.status, 201)
  assert.ok(res.body.token, 'no token returned')
  assert.equal(res.body.user.name, 'Ada Lovelace')
  ada = res.body
})

await check('the password never appears in a response', () => {
  assert.equal(ada.user.password, undefined)
})

await check('a second account registers', async () => {
  const res = await call('POST', '/auth/register', {
    body: { name: 'Grace Hopper', email: 'grace@pulsechat.test', password: 'compiler99' },
  })
  assert.equal(res.status, 201)
  grace = res.body
})

await check('a duplicate email is rejected with 409', async () => {
  const res = await call('POST', '/auth/register', {
    body: { name: 'Impostor', email: 'ada@pulsechat.test', password: 'analytical1' },
  })
  assert.equal(res.status, 409)
})

await check('a short password is rejected with 400', async () => {
  const res = await call('POST', '/auth/register', {
    body: { name: 'Short', email: 'short@pulsechat.test', password: 'abc' },
  })
  assert.equal(res.status, 400)
})

await check('login with the wrong password gives 401', async () => {
  const res = await call('POST', '/auth/login', {
    body: { email: 'ada@pulsechat.test', password: 'wrong-password' },
  })
  assert.equal(res.status, 401)
})

await check('login with the right password returns a token', async () => {
  const res = await call('POST', '/auth/login', {
    body: { email: 'ada@pulsechat.test', password: 'analytical1' },
  })
  assert.equal(res.status, 200)
  assert.ok(res.body.token)
})

await check('GET /auth/me without a token gives 401', async () => {
  const res = await call('GET', '/auth/me')
  assert.equal(res.status, 401)
})

await check('GET /auth/me with a forged token gives 401', async () => {
  const res = await call('GET', '/auth/me', { token: 'not.a.real.token' })
  assert.equal(res.status, 401)
})

await check('GET /auth/me returns the current user', async () => {
  const res = await call('GET', '/auth/me', { token: ada.token })
  assert.equal(res.body.user._id, ada.user._id)
})

/* ── CORS ───────────────────────────────────────────────────────────── */
section('CORS')

// CLIENT_URL is pinned to :5173, but Vite moves to the next free port when
// 5173 is taken. The dev client must still be able to reach the API.
const preflight = (origin) =>
  fetch(`${API}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type,authorization',
    },
  })

await check('the configured CLIENT_URL origin is allowed', async () => {
  const res = await preflight('http://localhost:5173')
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})

await check('a different localhost port is allowed in development', async () => {
  const res = await preflight('http://localhost:5174')
  assert.equal(
    res.headers.get('access-control-allow-origin'),
    'http://localhost:5174',
    'a Vite port fallback must not be blocked by CORS',
  )
})

await check('127.0.0.1 is allowed in development', async () => {
  const res = await preflight('http://127.0.0.1:5175')
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5175')
})

await check('an outside origin gets no allow-origin header', async () => {
  const res = await preflight('https://evil.example.com')
  assert.equal(res.headers.get('access-control-allow-origin'), null)
})

await check('a rejected origin is a clean denial, not a 500', async () => {
  const res = await preflight('https://evil.example.com')
  assert.ok(res.status < 500, `expected a non-5xx status, got ${res.status}`)
})

/* ── REST: users & rooms ────────────────────────────────────────────── */
section('Users and rooms')

await check('GET /users lists everyone else, including the bot', async () => {
  const res = await call('GET', '/users', { token: ada.token })
  const ids = res.body.users.map((u) => u._id)
  assert.ok(!ids.includes(ada.user._id), 'the caller should not be in the directory')
  assert.ok(ids.includes(String(bot._id)), 'the assistant should be in the directory')
})

await check('PUT /users/profile updates the display name', async () => {
  const res = await call('PUT', '/users/profile', {
    token: ada.token,
    body: { name: 'Ada L.' },
  })
  assert.equal(res.body.user.name, 'Ada L.')
})

await check('PUT /users/profile rejects a non-URL avatar', async () => {
  const res = await call('PUT', '/users/profile', {
    token: ada.token,
    body: { avatarUrl: 'javascript:alert(1)' },
  })
  assert.equal(res.status, 400)
})

await check('register also created the AI room', async () => {
  const res = await call('GET', '/rooms', { token: ada.token })
  assert.ok(
    res.body.rooms.some((room) => room.isAiRoom),
    'no isAiRoom in the room list',
  )
})

let dm
await check('POST /rooms/dm/:userId creates a DM', async () => {
  const res = await call('POST', `/rooms/dm/${grace.user._id}`, { token: ada.token })
  assert.equal(res.status, 201)
  assert.equal(res.body.room.isGroup, false)
  assert.equal(res.body.room.members.length, 2)
  dm = res.body.room
})

await check('members come back populated, not as bare ids', () => {
  assert.equal(typeof dm.members[0], 'object')
  assert.ok(dm.members[0].name)
})

await check('opening the same DM twice returns the same room', async () => {
  const res = await call('POST', `/rooms/dm/${grace.user._id}`, { token: ada.token })
  assert.equal(res.status, 200)
  assert.equal(res.body.room._id, dm._id)
})

let room
await check('POST /rooms creates a group with its members', async () => {
  const res = await call('POST', '/rooms', {
    token: ada.token,
    body: { name: '#engineering', members: [grace.user._id] },
  })
  assert.equal(res.status, 201)
  assert.equal(res.body.room.name, 'engineering', 'the leading # should be stripped')
  assert.equal(res.body.room.members.length, 2)
  room = res.body.room
})

await check('a non-member cannot read a room’s history', async () => {
  const outsider = await call('POST', '/auth/register', {
    body: { name: 'Outsider', email: 'out@pulsechat.test', password: 'passing123' },
  })
  const res = await call('GET', `/messages/${room._id}`, { token: outsider.body.token })
  assert.equal(res.status, 403)
})

/* ── sockets ────────────────────────────────────────────────────────── */
section('Realtime')

await check('a socket without a token is rejected', async () => {
  const socket = ioClient(WS, { transports: ['websocket'], reconnection: false })
  const err = await once(socket, 'connect_error', { where: 'connect_error' })
  assert.match(err.message, /unauthorized/i)
  socket.close()
})

const adaSocket = ioClient(WS, {
  transports: ['websocket'],
  auth: { token: ada.token },
  reconnection: false,
})
const graceSocket = ioClient(WS, {
  transports: ['websocket'],
  auth: { token: grace.token },
  reconnection: false,
})

// Attached before the handshake completes — presence broadcasts on connect, so
// waiting until afterwards would race the very event we want to observe.
const presenceSeen = collect(graceSocket, 'presence_update')

await check('both authenticated sockets connect', async () => {
  await Promise.all([once(adaSocket, 'connect'), once(graceSocket, 'connect')])
})

await check('presence_update reports both users online', async () => {
  await until(
    presenceSeen,
    (p) => {
      const ids = p.onlineUserIds.map(String)
      return ids.includes(ada.user._id) && ids.includes(grace.user._id)
    },
    { what: 'both users in presence_update' },
  )
})

await check('the assistant always reads as online', async () => {
  await until(presenceSeen, (p) => p.onlineUserIds.map(String).includes(String(bot._id)), {
    what: 'the bot in presence_update',
  })
})

await check('a late joiner gets an accurate roster without waiting for a broadcast', async () => {
  const latecomer = await call('POST', '/auth/register', {
    body: { name: 'Late Joiner', email: 'late@pulsechat.test', password: 'arriving1' },
  })
  const socket = ioClient(WS, {
    transports: ['websocket'],
    auth: { token: latecomer.body.token },
    reconnection: false,
  })
  const seen = collect(socket, 'presence_update')

  await until(
    seen,
    (p) => {
      const ids = p.onlineUserIds.map(String)
      return ids.includes(ada.user._id) && ids.includes(grace.user._id)
    },
    { what: 'a full roster on the joining socket' },
  )
  socket.close()
})

await check('isOnline in the database survives a reload race', async () => {
  // Reconnect twice in quick succession, the way a page refresh does.
  const first = ioClient(WS, {
    transports: ['websocket'],
    auth: { token: grace.token },
    reconnection: false,
  })
  await once(first, 'connect')
  const second = ioClient(WS, {
    transports: ['websocket'],
    auth: { token: grace.token },
    reconnection: false,
  })
  first.close()
  await once(second, 'connect')

  await new Promise((r) => setTimeout(r, 400))
  const res = await call('GET', '/users', { token: ada.token })
  const stored = res.body.users.find((u) => u._id === grace.user._id)
  assert.equal(stored.isOnline, true, 'a live user was left marked offline')
  second.close()
})

let delivered
await check('send_message broadcasts receive_message to the other member', async () => {
  adaSocket.emit('join_room', { roomId: room._id })
  graceSocket.emit('join_room', { roomId: room._id })

  const incoming = once(graceSocket, 'receive_message')
  adaSocket.emit('send_message', {
    roomId: room._id,
    content: 'First message over the socket.',
    tempId: 'tmp_smoke_1',
  })

  const payload = await incoming
  delivered = payload.message
  assert.equal(delivered.content, 'First message over the socket.')
})

await check('the sender is derived from the socket, not the payload', () => {
  assert.equal(String(delivered.sender._id), ada.user._id)
})

await check('the sender arrives populated with a name', () => {
  assert.ok(delivered.sender.name)
})

await check('tempId is echoed back so the client can reconcile', async () => {
  const incoming = once(adaSocket, 'receive_message')
  adaSocket.emit('send_message', {
    roomId: room._id,
    content: 'Second message.',
    tempId: 'tmp_smoke_2',
  })
  const payload = await incoming
  assert.equal(payload.message.tempId, 'tmp_smoke_2')
})

await check('a spoofed sender id in the payload is ignored', async () => {
  const incoming = once(graceSocket, 'receive_message')
  adaSocket.emit('send_message', {
    roomId: room._id,
    content: 'Trying to post as Grace.',
    sender: grace.user._id,
  })
  const payload = await incoming
  assert.equal(String(payload.message.sender._id), ada.user._id)
})

await check('a message to a room you are not in is refused', async () => {
  const outsider = await call('POST', '/auth/register', {
    body: { name: 'Nosy', email: 'nosy@pulsechat.test', password: 'passing123' },
  })
  const socket = ioClient(WS, {
    transports: ['websocket'],
    auth: { token: outsider.body.token },
    reconnection: false,
  })
  await once(socket, 'connect')

  const failure = once(socket, 'error')
  socket.emit('send_message', { roomId: room._id, content: 'let me in' })
  const payload = await failure
  assert.match(payload.message, /not a member/i)
  socket.close()
})

await check('typing relays to others but not back to the sender', async () => {
  let echoed = false
  const selfEcho = (p) => (echoed = p)
  adaSocket.on('typing', selfEcho)

  const incoming = once(graceSocket, 'typing')
  adaSocket.emit('typing', { roomId: room._id })

  const payload = await incoming
  assert.equal(String(payload.user._id), ada.user._id)
  assert.equal(payload.roomId, String(room._id))

  await new Promise((r) => setTimeout(r, 120))
  adaSocket.off('typing', selfEcho)
  assert.equal(echoed, false, 'the sender should not receive their own typing event')
})

await check('stop_typing relays too', async () => {
  const incoming = once(graceSocket, 'stop_typing')
  adaSocket.emit('stop_typing', { roomId: room._id })
  const payload = await incoming
  assert.equal(String(payload.user._id), ada.user._id)
})

await check('mark_read broadcasts message_read', async () => {
  const incoming = once(adaSocket, 'message_read')
  graceSocket.emit('mark_read', { roomId: room._id, messageId: delivered._id })
  const payload = await incoming
  assert.equal(payload.messageId, String(delivered._id))
  assert.equal(String(payload.userId), grace.user._id)
})

await check('note_update relays to the room', async () => {
  const incoming = once(graceSocket, 'note_update')
  adaSocket.emit('note_update', { roomId: room._id, content: '# Shared notes\n\n- one' })
  const payload = await incoming
  assert.match(payload.content, /Shared notes/)
  assert.equal(String(payload.user._id), ada.user._id)
})

/* ── history & unread ───────────────────────────────────────────────── */
section('History and unread counts')

await check('GET /messages returns the room oldest-first', async () => {
  const res = await call('GET', `/messages/${room._id}`, { token: ada.token })
  assert.ok(res.body.messages.length >= 3)
  const times = res.body.messages.map((m) => new Date(m.createdAt).getTime())
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'messages are not in order')
})

await check('hasMore is false when the room fits in one page', async () => {
  const res = await call('GET', `/messages/${room._id}`, { token: ada.token })
  assert.equal(res.body.hasMore, false)
})

await check('limit + before paginate backwards', async () => {
  const first = await call('GET', `/messages/${room._id}?limit=1`, { token: ada.token })
  assert.equal(first.body.messages.length, 1)
  assert.equal(first.body.hasMore, true)

  const older = await call(
    'GET',
    `/messages/${room._id}?limit=5&before=${encodeURIComponent(first.body.messages[0].createdAt)}`,
    { token: ada.token },
  )
  assert.ok(older.body.messages.length >= 1)
  assert.ok(
    new Date(older.body.messages.at(-1).createdAt) < new Date(first.body.messages[0].createdAt),
  )
})

await check('GET /rooms reports unread for the recipient', async () => {
  const res = await call('GET', '/rooms', { token: grace.token })
  const target = res.body.rooms.find((r) => String(r._id) === String(room._id))
  assert.ok(target.unread > 0, 'Grace should have unread messages')
})

await check('the sender has no unread in their own room', async () => {
  const res = await call('GET', '/rooms', { token: ada.token })
  const target = res.body.rooms.find((r) => String(r._id) === String(room._id))
  assert.equal(target.unread, 0)
})

await check('rooms come back newest-activity-first with lastMessage populated', async () => {
  const res = await call('GET', '/rooms', { token: ada.token })
  assert.equal(String(res.body.rooms[0]._id), String(room._id))
  assert.ok(res.body.rooms[0].lastMessage.content)
})

/* ── AI ─────────────────────────────────────────────────────────────── */
section('AI assistant (no provider key configured)')

await check('GET /ai/status reports it is unconfigured, with a reason', async () => {
  const res = await call('GET', '/ai/status', { token: ada.token })
  assert.equal(res.body.configured, false)
  assert.match(res.body.reason, /GEMINI_API_KEY/)
})

await check('POST /ai/chat fails with 503 rather than crashing', async () => {
  const res = await call('POST', '/ai/chat', {
    token: ada.token,
    body: { prompt: 'hello' },
  })
  assert.equal(res.status, 503)
})

await check('@ai in a room emits an error carrying the roomId', async () => {
  const failure = once(adaSocket, 'error')
  adaSocket.emit('send_message', { roomId: room._id, content: '@ai what is a websocket?' })
  const payload = await failure
  assert.equal(String(payload.roomId), String(room._id))
  assert.match(payload.message, /not configured/i)
})

await check('the question itself is still saved and broadcast', async () => {
  const res = await call('GET', `/messages/${room._id}`, { token: ada.token })
  assert.ok(res.body.messages.some((m) => m.content.startsWith('@ai')))
})

/* ── presence teardown ──────────────────────────────────────────────── */
section('Presence on disconnect')

await check('closing the last tab marks the user offline', async () => {
  const incoming = once(graceSocket, 'presence_update')
  adaSocket.close()
  const payload = await incoming
  assert.ok(!payload.onlineUserIds.map(String).includes(ada.user._id))
})

/* ── done ───────────────────────────────────────────────────────────── */
// `server.close()` alone waits on keep-alive sockets and never resolves; the
// socket.io server has to come down first.
graceSocket.close()
clearTimeout(watchdog)
await new Promise((resolve) => io.close(resolve))
server.closeAllConnections?.()
// Let the disconnect handlers finish their presence writes before the
// connection goes away underneath them.
await new Promise((r) => setTimeout(r, 150))
await disconnectDb().catch(() => {})
await mongo.stop().catch(() => {})

console.log(
  `\n${failures.length ? '\x1b[31m' : '\x1b[32m'}${passed} passed, ${failures.length} failed\x1b[0m\n`,
)
process.exit(failures.length ? 1 : 0)
