import 'dotenv/config'

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

export const env = {
  port: int(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  /** Every browser origin allowed to reach Express *and* Socket.io. */
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  botName: process.env.BOT_NAME || 'Pulse AI',

  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    geminiKey: process.env.GEMINI_API_KEY,
    // Alias, not a pinned version: pinned model ids get retired (404) or land on
    // a zero free-tier quota, while `-latest` keeps working.
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    groqKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    openaiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    contextMessages: int(process.env.AI_CONTEXT_MESSAGES, 10),
    maxOutputTokens: int(process.env.AI_MAX_OUTPUT_TOKENS, 800),
    requestsPerHour: int(process.env.AI_REQUESTS_PER_HOUR, 30),
  },
}

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/**
 * Shared by the Express CORS middleware and the Socket.io CORS option, which
 * are configured separately and must agree.
 *
 * Vite takes the next free port when 5173 is busy, so a dev client legitimately
 * shows up on 5174, 5175, and so on. Pinning to a single port turns that
 * ordinary event into "blocked by CORS policy", which reads like the server is
 * down. In development any loopback origin is accepted; production stays pinned
 * to CLIENT_URL exactly.
 *
 * Auth rides in an Authorization header rather than a cookie, so a permissive
 * dev origin does not hand another local page a usable session.
 */
export function isAllowedOrigin(origin) {
  // No Origin header at all: curl, same-origin navigation, server-to-server.
  if (!origin) return true
  if (env.clientOrigins.includes(origin)) return true
  return !env.isProd && LOOPBACK.test(origin)
}

/**
 * Fail loudly at boot rather than mysteriously on the first request. A missing
 * JWT secret in particular would silently sign tokens anyone could forge.
 */
export function assertEnv() {
  const missing = []
  if (!env.mongoUri) missing.push('MONGO_URI')
  if (!env.jwtSecret) missing.push('JWT_SECRET')

  if (missing.length) {
    console.error(
      `\n✖ Missing required environment variable(s): ${missing.join(', ')}\n` +
        `  Copy server/.env.example to server/.env and fill them in.\n`,
    )
    process.exit(1)
  }

  if (env.isProd && env.jwtSecret.length < 32) {
    console.error('\n✖ JWT_SECRET is too short for production. Use at least 32 characters.\n')
    process.exit(1)
  }
}
