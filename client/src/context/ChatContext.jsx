import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api'
import { AuthContext, ChatContext, SocketContext } from './contexts'
import { EMIT, ON, PAGE_SIZE, TYPING_DEBOUNCE, TYPING_HEARTBEAT } from '@/utils/constants'

/** Accept either `[...]` or `{ rooms: [...] }` so either backend shape works. */
const listOf = (data, key) => (Array.isArray(data) ? data : (data?.[key] ?? []))
const idOf = (v) => (typeof v === 'string' ? v : v?._id)
const byTime = (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
const sortRooms = (list) =>
  [...list].sort(
    (a, b) =>
      new Date(b.lastMessage?.createdAt || b.updatedAt || 0) -
      new Date(a.lastMessage?.createdAt || a.updatedAt || 0),
  )

function dedupe(list) {
  const seen = new Set()
  const out = []
  for (const m of list) {
    if (seen.has(m._id)) continue
    seen.add(m._id)
    out.push(m)
  }
  return out.sort(byTime)
}

export function ChatProvider({ children }) {
  const { user } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)

  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState(null)
  const [directory, setDirectory] = useState([])

  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState({}) // roomId -> Message[]
  const [history, setHistory] = useState({}) // roomId -> { loading, hasMore, loaded, error }

  const [online, setOnline] = useState(new Set())
  const [typing, setTyping] = useState({}) // roomId -> { userId: user }
  const [streams, setStreams] = useState({}) // roomId -> { text, active }
  const [unread, setUnread] = useState({})
  const [socketError, setSocketError] = useState(null)

  const activeRef = useRef(null)
  const typingTimers = useRef({})
  const typingSentAt = useRef({})
  const mutedStreams = useRef(new Set())
  const requested = useRef(new Set())
  const directoryRef = useRef([])
  const unreadRef = useRef({})

  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])

  useEffect(() => {
    directoryRef.current = directory
  }, [directory])

  useEffect(() => {
    unreadRef.current = unread
  }, [unread])

  // ── loading ───────────────────────────────────────────────────────

  const refreshRooms = useCallback(async () => {
    setRoomsLoading(true)
    setRoomsError(null)
    try {
      const data = await api.listRooms()
      const list = listOf(data, 'rooms')
      setRooms(sortRooms(list))

      // If the API reports unread counts, trust it for rooms we have not opened.
      setUnread((current) => {
        const next = { ...current }
        for (const room of list) {
          if (room.unread == null || room._id === activeRef.current) continue
          if (!requested.current.has(room._id)) next[room._id] = room.unread
        }
        return next
      })
    } catch (err) {
      setRoomsError(err.friendly || 'Could not load your conversations.')
    } finally {
      setRoomsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setRooms([])
      setMessages({})
      setHistory({})
      setUnread({})
      setActiveId(null)
      requested.current.clear()
      return
    }
    refreshRooms()
    api
      .listUsers()
      .then((data) => setDirectory(listOf(data, 'users')))
      .catch(() => setDirectory([]))
  }, [user, refreshRooms])

  const loadHistory = useCallback(async (roomId, before) => {
    if (!roomId) return
    setHistory((h) => ({ ...h, [roomId]: { ...h[roomId], loading: true, error: null } }))
    try {
      const data = await api.history(roomId, { before, limit: PAGE_SIZE })
      const page = listOf(data, 'messages')
      const hasMore = data?.hasMore ?? page.length >= PAGE_SIZE

      setMessages((m) => ({ ...m, [roomId]: dedupe([...page, ...(m[roomId] || [])]) }))
      setHistory((h) => ({ ...h, [roomId]: { loading: false, hasMore, loaded: true } }))
    } catch (err) {
      requested.current.delete(roomId) // let the user retry by re-opening
      setHistory((h) => ({
        ...h,
        [roomId]: {
          loading: false,
          hasMore: false,
          loaded: true,
          error: err.friendly || 'Could not load messages.',
        },
      }))
    }
  }, [])

  const loadOlder = useCallback(
    (roomId) => {
      const state = history[roomId]
      const oldest = messages[roomId]?.[0]
      if (!state?.hasMore || state.loading || !oldest) return
      return loadHistory(roomId, oldest.createdAt)
    },
    [history, messages, loadHistory],
  )

  // ── room selection ────────────────────────────────────────────────

  const openRoom = useCallback(
    (roomId) => {
      setActiveId(roomId)
      if (!roomId) return
      // Opening a room with a backlog clears it in one request rather than one
      // `mark_read` per unread message.
      if (unreadRef.current[roomId]) {
        setUnread((u) => ({ ...u, [roomId]: 0 }))
        api.markRoomRead(roomId).catch(() => {})
      }
      socket?.emit(EMIT.joinRoom, { roomId })
      if (!requested.current.has(roomId)) {
        requested.current.add(roomId)
        loadHistory(roomId)
      }
    },
    [socket, loadHistory],
  )

  const retryHistory = useCallback(
    (roomId) => {
      requested.current.add(roomId)
      loadHistory(roomId)
    },
    [loadHistory],
  )

  // Re-join after a reconnect — the server forgets our rooms when the socket drops.
  useEffect(() => {
    if (socket && activeId) socket.emit(EMIT.joinRoom, { roomId: activeId })
  }, [socket, activeId])

  // ── sending ───────────────────────────────────────────────────────

  const appendMessage = useCallback((roomId, message) => {
    setMessages((m) => {
      const list = m[roomId] || []
      if (list.some((x) => x._id === message._id)) return m
      return { ...m, [roomId]: [...list, message] }
    })
  }, [])

  const touchRoom = useCallback((roomId, message) => {
    setRooms((list) =>
      sortRooms(
        list.map((r) =>
          r._id === roomId ? { ...r, lastMessage: message, updatedAt: message.createdAt } : r,
        ),
      ),
    )
  }, [])

  const stopTyping = useCallback(
    (roomId) => {
      if (!typingTimers.current[roomId]) return
      clearTimeout(typingTimers.current[roomId])
      delete typingTimers.current[roomId]
      delete typingSentAt.current[roomId]
      socket?.emit(EMIT.stopTyping, { roomId })
    },
    [socket],
  )

  const sendMessage = useCallback(
    ({ roomId, content, type = 'text', fileName }) => {
      if (!roomId || !socket || !user) return null
      const tempId = `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
      const optimistic = {
        _id: tempId,
        tempId,
        room: roomId,
        sender: user,
        type,
        content,
        fileName,
        readBy: [user._id],
        createdAt: new Date().toISOString(),
        pending: true,
      }
      appendMessage(roomId, optimistic)
      touchRoom(roomId, optimistic)
      stopTyping(roomId)
      socket.emit(EMIT.sendMessage, { roomId, content, type, fileName, tempId })
      return optimistic
    },
    [socket, user, appendMessage, touchRoom, stopTyping],
  )

  /** Used by the dedicated AI page — asks the assistant without a room message. */
  const askAi = useCallback(
    ({ roomId, prompt }) => {
      if (!socket) return
      mutedStreams.current.delete(roomId)
      socket.emit(EMIT.aiMessage, { roomId, prompt })
    },
    [socket],
  )

  /** "Stop" simply tells this client to ignore the rest of the stream. */
  const stopStream = useCallback((roomId) => {
    mutedStreams.current.add(roomId)
    setStreams((s) => {
      const next = { ...s }
      delete next[roomId]
      return next
    })
  }, [])

  const notifyTyping = useCallback(
    (roomId) => {
      if (!socket || !roomId) return

      // Announce on the first keystroke, then re-announce on a slow heartbeat.
      // One event per burst would let the receiver's staleness sweep expire the
      // indicator while the person is still mid-sentence.
      const now = Date.now()
      if (now - (typingSentAt.current[roomId] || 0) >= TYPING_HEARTBEAT) {
        socket.emit(EMIT.typing, { roomId })
        typingSentAt.current[roomId] = now
      }

      clearTimeout(typingTimers.current[roomId])
      typingTimers.current[roomId] = setTimeout(() => {
        delete typingTimers.current[roomId]
        delete typingSentAt.current[roomId]
        socket.emit(EMIT.stopTyping, { roomId })
      }, TYPING_DEBOUNCE)
    },
    [socket],
  )

  const markRead = useCallback(
    (roomId, messageId) => {
      if (!socket || !messageId) return
      socket.emit(EMIT.markRead, { roomId, messageId })
    },
    [socket],
  )

  // ── room creation ─────────────────────────────────────────────────

  const createRoom = useCallback(async (payload) => {
    const data = await api.createRoom(payload)
    const room = data.room ?? data
    setRooms((list) => sortRooms([room, ...list.filter((r) => r._id !== room._id)]))
    return room
  }, [])

  const openDm = useCallback(async (userId) => {
    const data = await api.openDm(userId)
    const room = data.room ?? data
    setRooms((list) => sortRooms([room, ...list.filter((r) => r._id !== room._id)]))
    return room
  }, [])

  // ── socket wiring ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !user) return

    const hydrate = (message) => {
      if (message.sender && typeof message.sender === 'object') return message
      const id = idOf(message.sender)
      const found = [user, ...directoryRef.current].find((u) => u._id === id)
      return { ...message, sender: found || { _id: id, name: 'Unknown' } }
    }

    const onMessage = (payload) => {
      const message = hydrate(payload.message ?? payload)
      const roomId = idOf(message.room) || message.roomId
      if (!roomId) return

      setMessages((m) => {
        const list = m[roomId] || []
        const pendingIdx = list.findIndex(
          (x) =>
            x.pending &&
            (x.tempId === message.tempId ||
              (x.content === message.content && idOf(x.sender) === idOf(message.sender))),
        )
        if (pendingIdx > -1) {
          const next = [...list]
          next[pendingIdx] = message
          return { ...m, [roomId]: next }
        }
        if (list.some((x) => x._id === message._id)) return m
        return { ...m, [roomId]: [...list, message] }
      })

      touchRoom(roomId, message)

      const mine = idOf(message.sender) === user._id
      if (!mine && (roomId !== activeRef.current || document.hidden)) {
        setUnread((u) => ({ ...u, [roomId]: (u[roomId] || 0) + 1 }))
      }
    }

    const onTyping = ({ roomId, user: who }) => {
      if (!who || who._id === user._id) return
      setTyping((t) => ({ ...t, [roomId]: { ...(t[roomId] || {}), [who._id]: { ...who, at: Date.now() } } }))
    }

    const onStopTyping = ({ roomId, user: who }) => {
      if (!who) return
      setTyping((t) => {
        if (!t[roomId]) return t
        const next = { ...t[roomId] }
        delete next[who._id]
        return { ...t, [roomId]: next }
      })
    }

    const onAiTyping = ({ roomId }) => {
      mutedStreams.current.delete(roomId)
      setStreams((s) => ({ ...s, [roomId]: { text: '', active: true } }))
    }

    const onAiStream = ({ roomId, chunk }) => {
      if (mutedStreams.current.has(roomId)) return
      setStreams((s) => ({
        ...s,
        [roomId]: { text: (s[roomId]?.text || '') + chunk, active: true },
      }))
    }

    const onAiDone = (payload) => {
      const message = hydrate(payload.message ?? payload)
      const roomId = idOf(message.room) || message.roomId
      mutedStreams.current.delete(roomId)
      setStreams((s) => {
        const next = { ...s }
        delete next[roomId]
        return next
      })
      appendMessage(roomId, message)
      touchRoom(roomId, message)
    }

    const onPresence = ({ onlineUserIds = [] }) => setOnline(new Set(onlineUserIds))

    const onRead = ({ messageId, userId }) => {
      setMessages((m) => {
        const next = { ...m }
        for (const [roomId, list] of Object.entries(next)) {
          const idx = list.findIndex((x) => x._id === messageId)
          if (idx === -1) continue
          const target = list[idx]
          if (target.readBy?.includes(userId)) return m
          const copy = [...list]
          copy[idx] = { ...target, readBy: [...(target.readBy || []), userId] }
          next[roomId] = copy
          return next
        }
        return m
      })
    }

    const onError = (payload) => {
      setSocketError(payload?.message || 'Realtime connection error.')

      // An AI failure arrives with the room it belongs to — otherwise that
      // room would keep showing "thinking…" with nothing ever arriving.
      const roomId = payload?.roomId
      if (!roomId) return
      setStreams((s) => {
        if (!s[roomId]) return s
        const next = { ...s }
        delete next[roomId]
        return next
      })
    }

    socket.on(ON.receiveMessage, onMessage)
    socket.on(ON.typing, onTyping)
    socket.on(ON.stopTyping, onStopTyping)
    socket.on(ON.aiTyping, onAiTyping)
    socket.on(ON.aiStream, onAiStream)
    socket.on(ON.aiDone, onAiDone)
    socket.on(ON.presence, onPresence)
    socket.on(ON.messageRead, onRead)
    socket.on(ON.error, onError)

    return () => {
      socket.off(ON.receiveMessage, onMessage)
      socket.off(ON.typing, onTyping)
      socket.off(ON.stopTyping, onStopTyping)
      socket.off(ON.aiTyping, onAiTyping)
      socket.off(ON.aiStream, onAiStream)
      socket.off(ON.aiDone, onAiDone)
      socket.off(ON.presence, onPresence)
      socket.off(ON.messageRead, onRead)
      socket.off(ON.error, onError)
    }
  }, [socket, user, appendMessage, touchRoom])

  // A dropped `stop_typing` should never strand an indicator on screen.
  useEffect(() => {
    const sweep = setInterval(() => {
      setTyping((t) => {
        const cutoff = Date.now() - 5000
        let dirty = false
        const next = {}
        for (const [roomId, people] of Object.entries(t)) {
          const kept = Object.fromEntries(Object.entries(people).filter(([, v]) => v.at > cutoff))
          if (Object.keys(kept).length !== Object.keys(people).length) dirty = true
          next[roomId] = kept
        }
        return dirty ? next : t
      })
    }, 2000)
    return () => clearInterval(sweep)
  }, [])

  const activeRoom = useMemo(() => rooms.find((r) => r._id === activeId) || null, [rooms, activeId])
  const totalUnread = useMemo(
    () => Object.values(unread).reduce((sum, n) => sum + (n || 0), 0),
    [unread],
  )

  const value = useMemo(
    () => ({
      rooms,
      roomsLoading,
      roomsError,
      refreshRooms,
      directory,
      activeId,
      activeRoom,
      openRoom,
      messages,
      history,
      loadOlder,
      retryHistory,
      sendMessage,
      askAi,
      stopStream,
      notifyTyping,
      stopTyping,
      markRead,
      createRoom,
      openDm,
      online,
      typing,
      streams,
      unread,
      totalUnread,
      socketError,
      clearSocketError: () => setSocketError(null),
    }),
    [
      rooms,
      roomsLoading,
      roomsError,
      refreshRooms,
      directory,
      activeId,
      activeRoom,
      openRoom,
      messages,
      history,
      loadOlder,
      retryHistory,
      sendMessage,
      askAi,
      stopStream,
      notifyTyping,
      stopTyping,
      markRead,
      createRoom,
      openDm,
      online,
      typing,
      streams,
      unread,
      totalUnread,
      socketError,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
