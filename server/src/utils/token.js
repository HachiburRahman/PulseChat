import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

/**
 * The payload holds only the user id. Everything else — name, avatar, role — is
 * read fresh from the database on each request, so a stale token can never carry
 * stale identity.
 */
export function signToken(userId) {
  return jwt.sign({ id: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

/** Reads `Authorization: Bearer <token>`. */
export function bearerFrom(header = '') {
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}
