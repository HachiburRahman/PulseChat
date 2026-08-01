import { env } from '../config/env.js'

export function notFound(req, _res, next) {
  next(Object.assign(new Error(`No route for ${req.method} ${req.originalUrl}`), { status: 404 }))
}

/**
 * One place that turns anything thrown anywhere into `{ message }`, which is
 * exactly the shape the client's axios interceptor reads.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies this by arity
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500
  let message = err.message || 'Something went wrong'

  // Mongoose validation — surface the first useful field message.
  if (err.name === 'ValidationError') {
    status = 400
    message = Object.values(err.errors)[0]?.message || 'Those details are not valid'
  }

  // Duplicate key — almost always a taken email.
  if (err.code === 11000) {
    status = 409
    const field = Object.keys(err.keyPattern || {})[0]
    message = field === 'email' ? 'That email is already registered' : 'That already exists'
  }

  // A malformed ObjectId in a URL param.
  if (err.name === 'CastError') {
    status = 400
    message = 'That id is not valid'
  }

  if (status >= 500 && !err.expected) {
    console.error('✖', err)
  }

  res.status(status).json({
    message,
    ...(env.isProd ? {} : { stack: err.stack }),
  })
}
