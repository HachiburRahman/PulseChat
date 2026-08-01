import { Message } from '../models/Message.js'
import { Room } from '../models/Room.js'
import { PUBLIC_USER_FIELDS } from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { isBotId } from './botService.js'

export const AI_TRIGGER = '@ai'

export const isAiPrompt = (text = '') => text.trim().toLowerCase().startsWith(AI_TRIGGER)

export const stripAiTrigger = (text = '') =>
  text.trim().replace(new RegExp(`^${AI_TRIGGER}\\s*`, 'i'), '').trim()

/**
 * Loads a room and asserts the caller belongs to it. Every entry point — REST or
 * socket — goes through here, so membership is never assumed.
 */
export async function roomForMember(roomId, userId) {
  const room = await Room.findById(roomId)
  if (!room) throw ApiError.notFound('That conversation does not exist')
  if (!room.includes(userId)) throw ApiError.forbidden('You are not a member of that conversation')
  return room
}

/** Creates a message, points the room at it, and returns it fully populated. */
export async function saveMessage({
  roomId,
  senderId,
  content,
  type = 'text',
  fileName,
  isAi = false,
}) {
  const message = await Message.create({
    room: roomId,
    sender: senderId,
    content,
    type,
    fileName,
    isAi,
    readBy: [senderId], // your own message is read by you the moment you send it
  })

  // `updatedAt` moves too, which is what keeps the sidebar ordered.
  await Room.findByIdAndUpdate(roomId, { lastMessage: message._id, updatedAt: new Date() })

  return message.populate('sender', PUBLIC_USER_FIELDS)
}

/**
 * The last N messages of a room, shaped for the LLM. Capping this is what keeps
 * both the token bill and the latency predictable.
 */
export async function buildAiContext(roomId, { limit = env.ai.contextMessages, prompt } = {}) {
  const recent = await Message.find({ room: roomId, type: 'text' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  const history = recent
    .reverse()
    .map((message) => ({
      role: message.isAi || isBotId(message.sender) ? 'assistant' : 'user',
      content: stripAiTrigger(message.content),
    }))
    .filter((m) => m.content)

  // Drop a trailing assistant turn — providers expect the last turn to be a user.
  while (history.length && history.at(-1).role === 'assistant') history.pop()

  if (prompt) {
    const cleaned = stripAiTrigger(prompt)
    if (history.at(-1)?.content !== cleaned) history.push({ role: 'user', content: cleaned })
  }

  return history.length ? history : [{ role: 'user', content: stripAiTrigger(prompt || 'Hello') }]
}

/**
 * How many messages in each room the user has not read. One aggregation for the
 * whole sidebar rather than a query per room.
 */
export async function unreadCounts(userId, roomIds) {
  if (!roomIds.length) return {}

  const rows = await Message.aggregate([
    { $match: { room: { $in: roomIds }, sender: { $ne: userId }, readBy: { $ne: userId } } },
    { $group: { _id: '$room', count: { $sum: 1 } } },
  ])

  return Object.fromEntries(rows.map((row) => [String(row._id), row.count]))
}
