import { Router } from 'express'
import { chat, status } from '../controllers/ai.controller.js'
import { protect } from '../middleware/auth.middleware.js'
import { aiLimiter } from '../middleware/rateLimit.middleware.js'

const router = Router()

router.use(protect)
router.get('/status', status)

// The limiter keys on the authenticated user, so it must sit after `protect`.
router.post('/chat', aiLimiter, chat)

export default router
