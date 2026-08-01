import { Router } from 'express'
import { createRoom, listRooms, openDm } from '../controllers/room.controller.js'
import { protect } from '../middleware/auth.middleware.js'

const router = Router()

router.use(protect)
router.get('/', listRooms)
router.post('/', createRoom)
router.post('/dm/:userId', openDm)

export default router
