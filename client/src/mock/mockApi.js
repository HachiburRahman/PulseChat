import { PAGE_SIZE } from '@/utils/constants'
import { db, me, nextId, wait, messagesFor, hydratedRooms, insertMessage } from './store'

const TOKEN = 'demo.jwt.token'

/**
 * Speaks the same method-for-method contract as `liveApi` in `src/api/index.js`.
 * Latency is faked so loading states, skeletons and disabled buttons are all
 * exercised in demo mode exactly as they will be against the real server.
 */
export const mockApi = {
  async register({ name, email }) {
    await wait(520)
    const user = {
      _id: nextId('u'),
      name: name || 'New user',
      email,
      avatarUrl: '',
      isBot: false,
      isOnline: true,
      lastSeen: new Date().toISOString(),
    }
    db.users.push(user)
    db.byId[user._id] = user
    db.meId = user._id

    // A fresh account still gets the AI assistant waiting for them.
    db.rooms.push({
      _id: nextId('r'),
      name: 'Pulse AI',
      isGroup: false,
      isAiRoom: true,
      members: [user, db.byId[db.botId]],
      admin: user._id,
      updatedAt: new Date().toISOString(),
    })

    return { token: TOKEN, user }
  },

  async login() {
    await wait(480)
    return { token: TOKEN, user: me() }
  },

  async me() {
    await wait(180)
    return { user: me() }
  },

  async updateProfile(payload) {
    await wait(420)
    Object.assign(me(), payload)
    return { user: me() }
  },

  async listUsers() {
    await wait(240)
    return { users: db.users.filter((u) => u._id !== db.meId) }
  },

  async listRooms() {
    await wait(300)
    return { rooms: hydratedRooms() }
  },

  async createRoom({ name, members = [] }) {
    await wait(400)
    const room = {
      _id: nextId('r'),
      name,
      isGroup: true,
      isAiRoom: false,
      members: [me(), ...members.map((id) => db.byId[id]).filter(Boolean)],
      admin: db.meId,
      updatedAt: new Date().toISOString(),
    }
    db.rooms.push(room)
    return { room }
  },

  async openDm(userId) {
    await wait(320)
    const existing = db.rooms.find(
      (r) => !r.isGroup && r.members.length === 2 && r.members.some((m) => m._id === userId),
    )
    if (existing) return { room: existing }

    const peer = db.byId[userId]
    const room = {
      _id: nextId('r'),
      name: '',
      isGroup: false,
      isAiRoom: Boolean(peer?.isBot),
      members: [me(), peer].filter(Boolean),
      admin: db.meId,
      updatedAt: new Date().toISOString(),
    }
    db.rooms.push(room)
    return { room }
  },

  async history(roomId, { before, limit = PAGE_SIZE } = {}) {
    await wait(360)
    let list = messagesFor(roomId)
    if (before) {
      const cutoff = new Date(before).getTime()
      list = list.filter((m) => new Date(m.createdAt).getTime() < cutoff)
    }
    const page = list.slice(-limit)
    return { messages: page, hasMore: list.length > page.length }
  },

  async askAi({ roomId, prompt }) {
    await wait(900)
    const message = insertMessage({
      room: roomId,
      senderId: db.botId,
      content: `(non-streaming fallback) You asked: “${prompt}”`,
      isAi: true,
    })
    return { message }
  },

  async aiStatus() {
    await wait(120)
    return { configured: true, provider: 'demo', reason: null }
  },

  async markRoomRead(roomId) {
    await wait(160)
    const mine = db.meId
    let updated = 0
    for (const message of messagesFor(roomId)) {
      if (String(message.sender?._id) === mine || message.readBy.includes(mine)) continue
      message.readBy.push(mine)
      updated += 1
    }
    db.unread[roomId] = 0
    return { updated }
  },
}
