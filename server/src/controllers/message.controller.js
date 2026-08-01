import { Message } from '../models/Message.js'
import { PUBLIC_USER_FIELDS } from '../models/User.js'
import { asyncHandler, ApiError } from '../utils/ApiError.js'
import { roomForMember } from '../services/chatService.js'

const MAX_PAGE = 100

/**
 * GET /api/messages/:roomId?before=<iso>&limit=<n>
 *
 * Cursor pagination, not `skip`. Paging by timestamp stays fast however far back
 * you scroll, and cannot double-count when new messages arrive mid-scroll.
 */
export const history = asyncHandler(async (req, res) => {
  await roomForMember(req.params.roomId, req.user._id)

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), MAX_PAGE)

  const filter = { room: req.params.roomId }
  if (req.query.before) {
    const before = new Date(req.query.before)
    if (Number.isNaN(before.getTime())) throw ApiError.badRequest('`before` must be a date')
    filter.createdAt = { $lt: before }
  }

  // Newest-first walks the index; the client wants oldest-first, so flip after.
  const page = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1) // one extra row answers "is there more?" without a count
    .populate('sender', PUBLIC_USER_FIELDS)
    .lean()

  const hasMore = page.length > limit
  const messages = (hasMore ? page.slice(0, limit) : page).reverse()

  res.json({ messages, hasMore })
})

/** PATCH /api/messages/:roomId/read — bulk read receipt for a whole room. */
export const markRoomRead = asyncHandler(async (req, res) => {
  await roomForMember(req.params.roomId, req.user._id)

  const result = await Message.updateMany(
    { room: req.params.roomId, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } },
  )

  res.json({ updated: result.modifiedCount })
})
