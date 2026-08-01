import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { env } from '../config/env.js'

const shared = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Skip limiting in the smoke test, which fires many requests in a second.
  skip: () => process.env.DISABLE_RATE_LIMIT === 'true',
}

/** Blunt instrument against credential stuffing on register/login. */
export const authLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: 'Too many attempts. Try again in a few minutes.' },
})

/** The one that stops a public demo from draining your AI quota. */
export const aiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: env.ai.requestsPerHour,
  // Per user once authenticated. The IP fallback goes through `ipKeyGenerator`
  // so a whole IPv6 /64 cannot be used to mint unlimited distinct keys.
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : ipKeyGenerator(req.ip)),
  message: { message: 'You have hit the hourly AI limit. Try again later.' },
})

/** A generous ceiling on everything else. */
export const apiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: 300,
  message: { message: 'Slow down a moment.' },
})
