import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import mongoose from 'mongoose'

import { env, isAllowedOrigin } from './config/env.js'
import { apiLimiter } from './middleware/rateLimit.middleware.js'
import { errorHandler, notFound } from './middleware/error.middleware.js'

import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import roomRoutes from './routes/room.routes.js'
import messageRoutes from './routes/message.routes.js'
import aiRoutes from './routes/ai.routes.js'

export function createApp() {
  const app = express()

  // Render, Railway and friends sit behind a proxy; without this the rate
  // limiter would see every request as coming from the same address.
  app.set('trust proxy', 1)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(
    cors({
      // `callback(null, false)` denies cleanly. Passing an Error instead turns a
      // rejected origin into a 500, which hides the real reason in the logs.
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  if (!env.isProd && process.env.NODE_ENV !== 'test') app.use(morgan('dev'))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      uptime: Math.round(process.uptime()),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      env: env.nodeEnv,
    })
  })

  app.use('/api', apiLimiter)
  app.use('/api/auth', authRoutes)
  app.use('/api/users', userRoutes)
  app.use('/api/rooms', roomRoutes)
  app.use('/api/messages', messageRoutes)
  app.use('/api/ai', aiRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
