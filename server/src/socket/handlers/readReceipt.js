import mongoose from 'mongoose'
import { Message } from '../../models/Message.js'

/**
 * `mark_read` carries a message id, and the reader is taken from the socket —
 * never from the payload — so nobody can mark a message read on someone
 * else's behalf.
 */
export function registerReadReceiptHandlers(io, socket) {
  socket.on('mark_read', async ({ roomId, messageId } = {}) => {
    try {
      if (!mongoose.isValidObjectId(messageId)) return

      const message = await Message.findById(messageId).select('room sender readBy')
      if (!message) return

      // Your own message needs no receipt from you.
      if (String(message.sender) === socket.userId) return
      if (message.readBy.some((id) => String(id) === socket.userId)) return

      await Message.updateOne(
        { _id: messageId },
        { $addToSet: { readBy: socket.user._id } },
      )

      io.to(String(roomId || message.room)).emit('message_read', {
        messageId: String(messageId),
        userId: socket.userId,
      })
    } catch (err) {
      socket.emit('error', { message: 'Could not update the read receipt' })
      console.error('mark_read:', err.message)
    }
  })
}
