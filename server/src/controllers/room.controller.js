import mongoose from 'mongoose'
import { Room } from '../models/Room.js'
import { User, PUBLIC_USER_FIELDS } from '../models/User.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { unreadCounts } from '../services/chatService.js'
import { getBot } from '../services/botService.js'

const populated = (query) =>
  query
    .populate('members', PUBLIC_USER_FIELDS)
    .populate({ path: 'lastMessage', populate: { path: 'sender', select: PUBLIC_USER_FIELDS } })

/** GET /api/rooms — the sidebar, newest activity first, with unread counts. */
export const listRooms = asyncHandler(async (req, res) => {
  const rooms = await populated(Room.find({ members: req.user._id }).sort({ updatedAt: -1 })).lean()

  const unread = await unreadCounts(
    req.user._id,
    rooms.map((room) => room._id),
  )

  res.json({
    rooms: rooms.map((room) => ({ ...room, unread: unread[String(room._id)] || 0 })),
  })
})

/** POST /api/rooms — create a group channel. */
export const createRoom = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '')
    .trim()
    .replace(/^#/, '')
  if (!name) throw ApiError.badRequest('Give the room a name')

  const requested = Array.isArray(req.body.members) ? req.body.members : []
  const ids = requested.filter((id) => mongoose.isValidObjectId(id)).map(String)

  // Only ever add people who actually exist, and never the bot to a group.
  const valid = await User.find({ _id: { $in: ids }, isBot: { $ne: true } })
    .select('_id')
    .lean()

  const members = [...new Set([String(req.user._id), ...valid.map((u) => String(u._id))])]

  const created = await Room.create({
    name,
    isGroup: true,
    members,
    admin: req.user._id,
  })

  const room = await populated(Room.findById(created._id)).lean()
  res.status(201).json({ room: { ...room, unread: 0 } })
})

/**
 * POST /api/rooms/dm/:userId — get-or-create a 1-on-1 conversation.
 * Passing the bot's id is exactly how the AI chat gets opened.
 */
export const openDm = asyncHandler(async (req, res) => {
  const { userId } = req.params

  if (!mongoose.isValidObjectId(userId)) throw ApiError.badRequest('That user id is not valid')
  if (String(userId) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot message yourself')
  }

  const peer = await User.findById(userId)
  if (!peer) throw ApiError.notFound('That user does not exist')

  const bot = await getBot()
  const isAiRoom = String(peer._id) === String(bot._id)

  const existing = await Room.findOne({
    isGroup: false,
    members: { $all: [req.user._id, peer._id], $size: 2 },
  })

  if (existing) {
    const room = await populated(Room.findById(existing._id)).lean()
    const unread = await unreadCounts(req.user._id, [existing._id])
    return res.json({ room: { ...room, unread: unread[String(existing._id)] || 0 } })
  }

  const created = await Room.create({
    name: isAiRoom ? peer.name : '',
    isGroup: false,
    isAiRoom,
    members: [req.user._id, peer._id],
    admin: req.user._id,
  })

  const room = await populated(Room.findById(created._id)).lean()
  res.status(201).json({ room: { ...room, unread: 0 } })
})
