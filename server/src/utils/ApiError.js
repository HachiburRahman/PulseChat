/** An error with an HTTP status attached, so the error middleware can trust it. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.expected = true // distinguishes "you sent bad input" from "we broke"
    Error.captureStackTrace?.(this, ApiError)
  }

  static badRequest(message = 'Bad request') {
    return new ApiError(400, message)
  }
  static unauthorized(message = 'Not authorised') {
    return new ApiError(401, message)
  }
  static forbidden(message = 'You do not have access to that') {
    return new ApiError(403, message)
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message)
  }
  static conflict(message = 'That already exists') {
    return new ApiError(409, message)
  }
  static tooMany(message = 'Too many requests') {
    return new ApiError(429, message)
  }
}

/**
 * Express 5 forwards rejected promises automatically, but wrapping keeps the
 * intent obvious and stays correct if a handler is ever called directly.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)
