import { useContext, useEffect, useMemo, useState } from 'react'
import { createSocket } from '@/socket/socket'
import { AuthContext, SocketContext } from './contexts'

/**
 * A single socket for the whole app: opened once the user is authenticated,
 * torn down on logout. Components never create their own.
 *
 * The connection is deliberately created inside an effect rather than a lazy
 * `useState` initialiser: StrictMode double-invokes those initialisers, which
 * would open two sockets and leak one. An effect gets a cleanup, so the extra
 * development-mode connection is closed properly.
 */
export function SocketProvider({ children }) {
  const { user, token } = useContext(AuthContext)
  const [socket, setSocket] = useState(null)
  const [conn, setConn] = useState(null) // null | 'live' | 'down'

  useEffect(() => {
    if (!user || !token) return

    const s = createSocket({ token, user })
    const up = () => setConn('live')
    const down = () => setConn('down')

    s.on('connect', up)
    s.on('disconnect', down)
    s.on('connect_error', down)

    // Storing the instance is the whole point of this effect — consumers need
    // to re-render when the connection is swapped.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(s)

    return () => {
      s.off('connect', up)
      s.off('disconnect', down)
      s.off('connect_error', down)
      s.disconnect()
      setSocket(null)
      setConn(null)
    }
  }, [user, token])

  const status = !socket ? 'idle' : (conn ?? 'connecting')

  const value = useMemo(
    () => ({ socket, status, live: status === 'live' }),
    [socket, status],
  )

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
