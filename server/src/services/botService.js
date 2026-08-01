import { User } from '../models/User.js'
import { Room } from '../models/Room.js'
import { env } from '../config/env.js'

let cachedBotId = null

/**
 * The assistant is an ordinary User with `isBot: true` — that is what lets it
 * own messages, appear in a DM and be rendered by the same components as anyone
 * else. Created once on boot, then cached for the process lifetime.
 */
export async function ensureBot() {
  const bot = await User.findOneAndUpdate(
    { isBot: true },
    {
      $setOnInsert: { isBot: true, avatarUrl: '' },
      $set: { name: env.botName, isOnline: true, lastSeen: new Date() },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
  )

  cachedBotId = bot._id
  return bot
}

export async function getBot() {
  if (cachedBotId) {
    const bot = await User.findById(cachedBotId)
    if (bot) return bot
  }
  return ensureBot()
}

export function getBotId() {
  return cachedBotId
}

export function isBotId(id) {
  return cachedBotId && String(id) === String(cachedBotId)
}

/** Every account gets the assistant waiting in their sidebar from day one. */
export async function ensureAiRoomFor(userId) {
  const bot = await getBot()

  const existing = await Room.findOne({ isAiRoom: true, members: { $all: [userId, bot._id] } })
  if (existing) return existing

  return Room.create({
    name: env.botName,
    isGroup: false,
    isAiRoom: true,
    members: [userId, bot._id],
    admin: userId,
  })
}

/** Clear the cache between tests so a fresh database re-seeds its own bot. */
export function resetBotCache() {
  cachedBotId = null
}
