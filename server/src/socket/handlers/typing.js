/**
 * Typing is pure relay — nothing is persisted. The client debounces so this
 * fires once per burst rather than once per keystroke, and it also sweeps its
 * own indicators after a few seconds in case a `stop_typing` is ever lost.
 */
export function registerTypingHandlers(io, socket) {
  const who = {
    _id: socket.user._id,
    name: socket.user.name,
    avatarUrl: socket.user.avatarUrl,
  }

  const relay = (event) => ({ roomId } = {}) => {
    if (!roomId) return
    // `socket.to` excludes the sender — you never see your own typing bubble.
    socket.to(String(roomId)).emit(event, { roomId: String(roomId), user: who })
  }

  socket.on('typing', relay('typing'))
  socket.on('stop_typing', relay('stop_typing'))
}
