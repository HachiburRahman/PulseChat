import { User } from '../models/User.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { signToken } from '../utils/token.js'
import { ensureAiRoomFor } from '../services/botService.js'

/** POST /api/auth/register */
export const register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim()
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase()
  const { password } = req.body

  if (!name || !email || !password) {
    throw ApiError.badRequest('Name, email and password are all required')
  }
  if (String(password).length < 8) {
    throw ApiError.badRequest('Use a password of at least 8 characters')
  }
  if (await User.exists({ email })) {
    throw ApiError.conflict('That email is already registered')
  }

  const user = await User.create({ name, email, password })

  // So "Ask Pulse AI" is there the first time they open the app.
  await ensureAiRoomFor(user._id)

  res.status(201).json({ token: signToken(user._id), user: user.toJSON() })
})

/** POST /api/auth/login */
export const login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '')
    .trim()
    .toLowerCase()
  const { password } = req.body

  if (!email || !password) throw ApiError.badRequest('Email and password are required')

  const user = await User.findOne({ email, isBot: { $ne: true } }).select('+password')

  // One message for both branches — never reveal which accounts exist.
  if (!user || !(await user.matchesPassword(password))) {
    throw ApiError.unauthorized('Those credentials did not match')
  }

  await ensureAiRoomFor(user._id)

  res.json({ token: signToken(user._id), user: user.toJSON() })
})

/** GET /api/auth/me */
export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toJSON() })
})
