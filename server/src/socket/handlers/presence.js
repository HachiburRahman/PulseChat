import { User } from '../../models/User.js'
import { getBotId } from '../../services/botService.js'

/**
 * userId → set of that user's live socket ids.
 *
 * The set is the whole point: one person with five tabs open holds five
 * sockets, and closing one of them must not mark them offline. Only the
 * transition from empty-to-one and one-to-empty touches the database.
 */
const liveSockets = new Map()

export function onlineUserIds() {
  const ids = [...liveSockets.keys()]
  const botId = getBotId()
  // The assistant is always available, so it is always shown online.
  if (botId) ids.push(String(botId))
  return ids
}

export function broadcastPresence(io) {
  const ids = onlineUserIds()
  if (process.env.DEBUG_PRESENCE === 'true') {
    console.log(
      `[presence] sockets=${io.sockets.sockets.size} map=${[...liveSockets.entries()]
        .map(([u, s]) => `${u.slice(-6)}:${s.size}`)
        .join(',')} → broadcasting ${ids.length}`,
    )
  }
  io.emit('presence_update', { onlineUserIds: ids })
}

/**
 * Writes whatever the in-memory map says at write time, then re-checks.
 *
 * A page reload interleaves a connect and a disconnect within milliseconds, and
 * the two database writes can land in either order — leaving `isOnline: false`
 * on a user whose socket is very much alive. The map is the source of truth;
 * this just makes the persisted copy agree with it.
 */
async function syncOnlineFlag(userId) {
  const desired = (liveSockets.get(userId)?.size ?? 0) > 0
  await User.findByIdAndUpdate(userId, { isOnline: desired, lastSeen: new Date() })

  const settled = (liveSockets.get(userId)?.size ?? 0) > 0
  if (settled !== desired) await User.findByIdAndUpdate(userId, { isOnline: settled })
}

export async function handleConnect(io, socket) {
  const { userId } = socket

  const existing = liveSockets.get(userId)
  const isFirstTab = !existing || existing.size === 0

  if (existing) existing.add(socket.id)
  else liveSockets.set(userId, new Set([socket.id]))

  if (isFirstTab) await syncOnlineFlag(userId)

  broadcastPresence(io)
}

export async function handleDisconnect(io, socket) {
  const { userId } = socket
  const sockets = liveSockets.get(userId)
  if (!sockets) return

  sockets.delete(socket.id)
  if (sockets.size > 0) return // other tabs are still open

  liveSockets.delete(userId)
  await syncOnlineFlag(userId)
  broadcastPresence(io)
}

/**
 * A private snapshot for one socket. Broadcasts only fire when somebody joins
 * or leaves, so a client that connects during a gap — or misses a frame — would
 * otherwise sit on a stale roster until the next person comes or goes.
 */
export function sendPresenceSnapshot(socket) {
  socket.emit('presence_update', { onlineUserIds: onlineUserIds() })
}

/** Used on boot to clear stale `isOnline` flags left by a crash or redeploy. */
export async function resetPresence() {
  liveSockets.clear()
  await User.updateMany({ isOnline: true, isBot: { $ne: true } }, { isOnline: false })
}
