import { io } from 'socket.io-client'
import { SOCKET_URL, DEMO_MODE } from '@/utils/constants'
import { createMockSocket } from '@/mock/mockSocket'

/**
 * One socket per signed-in session. The JWT rides in the handshake `auth`
 * payload — the server verifies it once in `io.use()` and every subsequent
 * event on the connection is already tied to a real user.
 */
export function createSocket({ token, user }) {
  if (DEMO_MODE) return createMockSocket({ user })

  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 700,
    reconnectionDelayMax: 6000,
    withCredentials: true,
  })
}
