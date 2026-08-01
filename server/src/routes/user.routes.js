import { Router } from 'express'
import { listUsers, updateProfile } from '../controllers/user.controller.js'
import { protect } from '../middleware/auth.middleware.js'

const router = Router()

router.use(protect)
router.get('/', listUsers)
router.put('/profile', updateProfile)

export default router
