import { roomForMember } from '../../services/chatService.js'

const MAX_NOTE = 40_000

/**
 * The collaborative notes room. Deliberately last-write-wins rather than a CRDT:
 * it is a stretch feature, and the honest simple version is better than a
 * half-built operational-transform layer.
 *
 *   client → server   note_update  { roomId, content }
 *   server → client   note_update  { roomId, content, user }
 */
export function registerNotesHandlers(io, socket) {
  socket.on('note_update', async ({ roomId, content } = {}) => {
    try {
      if (!roomId || typeof content !== 'string') return
      if (content.length > MAX_NOTE) {
        return socket.emit('error', { roomId, message: 'That document is too large to sync.' })
      }

      await roomForMember(roomId, socket.user._id)

      socket.to(String(roomId)).emit('note_update', {
        roomId: String(roomId),
        content,
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          avatarUrl: socket.user.avatarUrl,
        },
      })
    } catch (err) {
      socket.emit('error', { roomId, message: err.message || 'Could not sync the notes' })
    }
  })
}
