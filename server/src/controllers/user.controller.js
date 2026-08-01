import { User, PUBLIC_USER_FIELDS } from '../models/User.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'

/** GET /api/users — the directory used to start a DM. Includes the bot. */
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } })
    .select(PUBLIC_USER_FIELDS)
    .sort({ isBot: -1, name: 1 })
    .lean()

  res.json({ users })
})

/** PUT /api/users/profile */
export const updateProfile = asyncHandler(async (req, res) => {
  const updates = {}

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) throw ApiError.badRequest('Your name cannot be empty')
    updates.name = name
  }

  if (req.body.avatarUrl !== undefined) {
    const url = String(req.body.avatarUrl).trim()
    // Only ever store a URL — the bytes themselves live in Firebase Storage.
    if (url && !/^https?:\/\//i.test(url)) {
      throw ApiError.badRequest('The avatar must be an http(s) URL')
    }
    updates.avatarUrl = url
  }

  if (!Object.keys(updates).length) throw ApiError.badRequest('Nothing to update')

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    returnDocument: 'after',
    runValidators: true,
  })

  res.json({ user: user.toJSON() })
})
