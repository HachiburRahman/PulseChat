import { isAiPrompt, roomForMember, saveMessage, stripAiTrigger } from '../../services/chatService.js'
import { runAiReply } from './ai.js'

const TYPES = new Set(['text', 'image', 'file'])
const MAX_LENGTH = 8000

export function registerMessageHandlers(io, socket) {
  /** `join_room` — subscribe this socket to a room it belongs to. */
  socket.on('join_room', async ({ roomId } = {}) => {
    try {
      if (!roomId) return
      await roomForMember(roomId, socket.user._id)
      socket.join(String(roomId))
    } catch (err) {
      socket.emit('error', { roomId, message: err.message || 'Could not join that conversation' })
    }
  })

  socket.on('leave_room', ({ roomId } = {}) => {
    if (roomId) socket.leave(String(roomId))
  })

  socket.on('send_message', async ({ roomId, content, type = 'text', fileName, tempId } = {}) => {
    try {
      const text = String(content ?? '').trim()
      if (!text) return
      if (text.length > MAX_LENGTH) {
        return socket.emit('error', { roomId, message: 'That message is too long.' })
      }
      if (!TYPES.has(type)) {
        return socket.emit('error', { roomId, message: 'Unsupported message type.' })
      }

      // Membership is re-checked on every send — never trusted from the payload.
      const room = await roomForMember(roomId, socket.user._id)

      const message = await saveMessage({
        roomId: room._id,
        senderId: socket.user._id, // the authenticated user, not a client-sent id
        content: text,
        type,
        fileName,
      })

      // A late-joining socket still gets the broadcast.
      socket.join(String(room._id))

      // `tempId` is echoed straight back so the sender can reconcile the
      // optimistic bubble it already painted.
      io.to(String(room._id)).emit('receive_message', {
        message: { ...message.toJSON(), tempId },
      })

      // An AI room answers everything; elsewhere the assistant waits for `@ai`.
      const summoned = room.isAiRoom || isAiPrompt(text)
      if (summoned && type === 'text') {
        runAiReply(io, {
          room,
          prompt: stripAiTrigger(text) || text,
          requesterId: socket.userId,
        })
      }
    } catch (err) {
      socket.emit('error', { roomId, message: err.message || 'Could not send that message' })
    }
  })
}
