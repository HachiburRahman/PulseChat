import { Router } from 'express'
import { history, markRoomRead } from '../controllers/message.controller.js'
import { protect } from '../middleware/auth.middleware.js'

const router = Router()

router.use(protect)
router.get('/:roomId', history)
router.patch('/:roomId/read', markRoomRead)

export default router
