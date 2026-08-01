import { User } from '../models/User.js'
import { bearerFrom, verifyToken } from '../utils/token.js'

/**
 * The WebSocket handshake is authenticated exactly once, here. From this point
 * every event on the connection already belongs to a known user — which is why
 * no handler ever reads a user id out of a client payload.
 */
export async function socketAuth(socket, next) {
  const token =
    socket.handshake.auth?.token ||
    bearerFrom(socket.handshake.headers?.authorization) ||
    socket.handshake.query?.token

  if (!token) return next(new Error('Unauthorized: no token in the handshake'))

  try {
    const { id } = verifyToken(token)
    const user = await User.findById(id)
    if (!user) return next(new Error('Unauthorized: that account no longer exists'))

    socket.user = user
    socket.userId = String(user._id)
    next()
  } catch (err) {
    next(
      new Error(
        err.name === 'TokenExpiredError' ? 'Unauthorized: session expired' : 'Unauthorized',
      ),
    )
  }
}
