import { Router } from 'express'
import { login, me, register } from '../controllers/auth.controller.js'
import { protect } from '../middleware/auth.middleware.js'
import { authLimiter } from '../middleware/rateLimit.middleware.js'

const router = Router()

router.post('/register', authLimiter, register)
router.post('/login', authLimiter, login)
router.get('/me', protect, me)

export default router
