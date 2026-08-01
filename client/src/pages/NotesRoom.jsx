import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LuChevronLeft, LuEye, LuPencilLine, LuUsers } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useChat } from '@/hooks/useChat'
import { useSocket } from '@/hooks/useSocket'
import { roomTitle } from '@/utils/format'
import { ROUTES } from '@/utils/constants'
import { Avatar, AvatarStack } from '@/components/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Stretch feature from the roadmap. The client half is complete; it speaks two
 * events the server needs a handler for:
 *   client → server  `note_update` { roomId, content }
 *   server → client  `note_update` { roomId, content, user }   (broadcast)
 * Until those exist the editor still works locally and saves per room.
 */
const NOTE_EVENT = 'note_update'
const SYNC_DEBOUNCE = 400
const storageKey = (roomId) => `pulsechat.notes.${roomId}`

const PLACEHOLDER = `# Sprint notes

- [ ] Wire read receipts into the message list
- [ ] Cap AI context at the last 10 messages
- [ ] Record the two-window demo GIF

Everyone in this room edits the same document — changes broadcast as you type.
`

export default function NotesRoom() {
  const { roomId } = useParams()
  const { rooms } = useChat()
  const navigate = useNavigate()

  const room = rooms.find((r) => r._id === roomId)

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg">
        <EmptyState
          icon={LuUsers}
          title="Room not found"
          body="Shared notes live inside a room you are a member of."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.chat)}>
              Back to conversations
            </Button>
          }
        />
      </div>
    )
  }

  // Keyed so navigating between rooms remounts the editor with that room's doc.
  return <NotesEditor key={roomId} roomId={roomId} room={room} />
}

function NotesEditor({ roomId, room }) {
  const { online } = useChat()
  const { socket, live } = useSocket()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [content, setContent] = useState(
    () => localStorage.getItem(storageKey(roomId)) || PLACEHOLDER,
  )
  const [mode, setMode] = useState('write')
  const [status, setStatus] = useState('idle') // idle | syncing | synced
  const [editors, setEditors] = useState({})
  const timer = useRef(null)
  const muted = useRef(false)

  // ── inbound edits ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return
    const onRemote = (payload) => {
      if (payload?.roomId !== roomId) return
      if (payload.user?._id === user?._id) return
      muted.current = true
      setContent(payload.content ?? '')
      if (payload.user) {
        setEditors((e) => ({ ...e, [payload.user._id]: { ...payload.user, at: Date.now() } }))
      }
      requestAnimationFrame(() => {
        muted.current = false
      })
    }
    socket.on(NOTE_EVENT, onRemote)
    return () => socket.off(NOTE_EVENT, onRemote)
  }, [socket, roomId, user])

  // Drop collaborator chips a few seconds after their last keystroke.
  useEffect(() => {
    const sweep = setInterval(() => {
      setEditors((e) => {
        const cutoff = Date.now() - 6000
        const kept = Object.fromEntries(Object.entries(e).filter(([, v]) => v.at > cutoff))
        return Object.keys(kept).length === Object.keys(e).length ? e : kept
      })
    }, 2500)
    return () => clearInterval(sweep)
  }, [])

  // ── outbound edits ────────────────────────────────────────────────
  const broadcast = useCallback(
    (value) => {
      localStorage.setItem(storageKey(roomId), value)
      socket?.emit(NOTE_EVENT, { roomId, content: value })
      setStatus('synced')
    },
    [socket, roomId],
  )

  const onChange = (e) => {
    const value = e.target.value
    setContent(value)
    if (muted.current) return
    setStatus('syncing')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => broadcast(value), SYNC_DEBOUNCE)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    return { words, chars: content.length, lines: content.split('\n').length }
  }, [content])

  const collaborators = Object.values(editors)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-bg">
      <header className="shrink-0 border-b border-line bg-elev/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-4 sm:px-8">
          <button
            onClick={() => navigate(ROUTES.room(roomId))}
            aria-label="Back to the room"
            className="no-tap -ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            <LuChevronLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[0.9375rem] font-semibold leading-tight">
              Shared notes
            </h1>
            <p className="mt-0.5 truncate text-xs text-ink-3">
              #{roomTitle(room, user?._id)} ·{' '}
              <span
                className={cn(
                  status === 'syncing' ? 'text-signal' : status === 'synced' ? 'text-online' : '',
                )}
              >
                {!live
                  ? 'Offline — saved locally'
                  : status === 'syncing'
                    ? 'Syncing…'
                    : status === 'synced'
                      ? 'All changes shared'
                      : 'Ready'}
              </span>
            </p>
          </div>

          {collaborators.length > 0 && (
            <span className="hidden items-center gap-2 sm:flex">
              <span className="label">editing</span>
              <AvatarStack users={collaborators} max={3} />
            </span>
          )}

          <div className="flex rounded-xl border border-line bg-surface-2 p-0.5">
            <ModeBtn active={mode === 'write'} onClick={() => setMode('write')} icon={LuPencilLine}>
              Write
            </ModeBtn>
            <ModeBtn active={mode === 'preview'} onClick={() => setMode('preview')} icon={LuEye}>
              Preview
            </ModeBtn>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8">
          {mode === 'write' ? (
            <textarea
              value={content}
              onChange={onChange}
              spellCheck="false"
              placeholder="Start typing — everyone in the room sees it."
              className="min-h-[60vh] w-full resize-none rounded-2xl border border-line bg-surface p-5 font-mono text-[0.875rem] leading-relaxed text-ink placeholder:text-ink-3/60 focus:border-signal/50 focus:outline-none focus:ring-4 focus:ring-signal/10"
            />
          ) : (
            <div className="prose-ai min-h-[60vh] rounded-2xl border border-line bg-surface p-6 text-ink">
              <Markdown remarkPlugins={[remarkGfm]}>{content || '_Nothing here yet._'}</Markdown>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
            <span className="label">{stats.words} words</span>
            <span className="label">{stats.chars} characters</span>
            <span className="label">{stats.lines} lines</span>
            <span className="ml-auto flex items-center gap-2">
              <span className="label">room</span>
              <span className="flex -space-x-2">
                {(room.members || []).slice(0, 5).map((m) => (
                  <Avatar
                    key={m._id}
                    user={m}
                    size="xs"
                    online={online.has(m._id)}
                    showStatus
                    className="ring-2 ring-bg rounded-lg"
                  />
                ))}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition',
        active ? 'bg-elev text-ink shadow-lift' : 'text-ink-3 hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{children}</span>
    </button>
  )
}
