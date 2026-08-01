import { User } from '../models/User.js'
import { ApiError, asyncHandler } from '../utils/ApiError.js'
import { bearerFrom, verifyToken } from '../utils/token.js'

/** Verifies the JWT and hangs the *current* user document off `req.user`. */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = bearerFrom(req.headers.authorization)
  if (!token) throw ApiError.unauthorized('Sign in to continue')

  let payload
  try {
    payload = verifyToken(token)
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Your session expired — sign in again' : 'Invalid token',
    )
  }

  const user = await User.findById(payload.id)
  if (!user) throw ApiError.unauthorized('That account no longer exists')

  req.user = user
  next()
})
