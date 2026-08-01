import { users, rooms, messages, byId, ME_ID, BOT_ID, seedUnread } from './mockData'

/**
 * A tiny in-memory stand-in for MongoDB. Shared by the mock REST client and the
 * mock socket so a message sent over "the wire" shows up in "history" too.
 * Lives for the lifetime of the tab — a reload resets it to the seed.
 */
export const db = {
  users: [...users],
  rooms: [...rooms],
  messages: [...messages],
  byId: { ...byId },
  meId: ME_ID,
  botId: BOT_ID,
  unread: { ...seedUnread },
  seq: 1000,
}

export const me = () => db.byId[db.meId]

export const nextId = (prefix) => `${prefix}_${++db.seq}`

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function roomById(id) {
  return db.rooms.find((r) => r._id === id) || null
}

export function messagesFor(roomId) {
  return db.messages
    .filter((m) => m.room === roomId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

export function lastMessageOf(roomId) {
  const list = messagesFor(roomId)
  return list[list.length - 1] || null
}

export function insertMessage({ room, senderId, content, type = 'text', fileName, isAi = false }) {
  const record = {
    _id: nextId('m'),
    room,
    sender: db.byId[senderId],
    type,
    isAi,
    content,
    fileName,
    readBy: [senderId],
    createdAt: new Date().toISOString(),
  }
  db.messages.push(record)
  const target = roomById(room)
  if (target) target.updatedAt = record.createdAt
  return record
}

/** Rooms decorated the way the REST API would return them. */
export function hydratedRooms() {
  return db.rooms
    .map((room) => ({
      ...room,
      lastMessage: lastMessageOf(room._id),
      unread: db.unread[room._id] || 0,
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}
