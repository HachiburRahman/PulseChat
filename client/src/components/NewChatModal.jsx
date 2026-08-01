import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuCheck, LuHash, LuSearch, LuUserRound } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useChat } from '@/hooks/useChat'
import { ROUTES } from '@/utils/constants'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Avatar } from './Avatar'

export function NewChatModal({ open, onClose }) {
  const { directory, online, openDm, createRoom } = useChat()
  const navigate = useNavigate()

  const [tab, setTab] = useState('dm')
  const [query, setQuery] = useState('')
  const [roomName, setRoomName] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    return directory.filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
  }, [directory, query])

  const reset = () => {
    setQuery('')
    setRoomName('')
    setPicked([])
    setError(null)
    setBusy(false)
  }

  const close = () => {
    reset()
    onClose()
  }

  const startDm = async (userId) => {
    setBusy(true)
    setError(null)
    try {
      const room = await openDm(userId)
      close()
      navigate(ROUTES.room(room._id))
    } catch (err) {
      setError(err.friendly || 'Could not open that conversation.')
      setBusy(false)
    }
  }

  const submitRoom = async (e) => {
    e.preventDefault()
    const name = roomName.trim()
    if (!name) return setError('Give the room a name.')
    setBusy(true)
    setError(null)
    try {
      const room = await createRoom({ name: name.replace(/^#/, ''), members: picked })
      close()
      navigate(ROUTES.room(room._id))
    } catch (err) {
      setError(err.friendly || 'Could not create the room.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={tab === 'dm' ? 'Start a conversation' : 'Create a room'}
      subtitle={
        tab === 'dm'
          ? 'Pick someone to message directly.'
          : 'Public channel anyone in the workspace can join.'
      }
      footer={
        tab === 'room' && (
          <>
            <Button variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button variant="signal" size="sm" loading={busy} onClick={submitRoom}>
              Create room
            </Button>
          </>
        )
      }
    >
      <div className="mb-5 flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
        <TabButton active={tab === 'dm'} onClick={() => setTab('dm')} icon={LuUserRound}>
          Direct message
        </TabButton>
        <TabButton active={tab === 'room'} onClick={() => setTab('room')} icon={LuHash}>
          New room
        </TabButton>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {tab === 'dm' ? (
        <div className="space-y-3">
          <Field
            icon={LuSearch}
            placeholder="Search people…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="-mx-1 space-y-0.5">
            {people.map((person) => (
              <li key={person._id}>
                <button
                  disabled={busy}
                  onClick={() => startDm(person._id)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2 disabled:opacity-50"
                >
                  <Avatar user={person} size="sm" online={online.has(person._id)} showStatus />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {person.isBot ? 'AI assistant · always on' : person.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {!people.length && (
              <li className="px-2 py-8 text-center text-sm text-ink-3">No one matches “{query}”.</li>
            )}
          </ul>
        </div>
      ) : (
        <form onSubmit={submitRoom} className="space-y-5">
          <Field
            label="Room name"
            icon={LuHash}
            placeholder="design-crit"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={40}
            autoFocus
          />

          <div className="space-y-2">
            <p className="label">Invite people ({picked.length})</p>
            <ul className="-mx-1 max-h-56 space-y-0.5 overflow-y-auto">
              {directory
                .filter((u) => !u.isBot)
                .map((person) => {
                  const selected = picked.includes(person._id)
                  return (
                    <li key={person._id}>
                      <button
                        type="button"
                        onClick={() =>
                          setPicked((list) =>
                            selected ? list.filter((id) => id !== person._id) : [...list, person._id],
                          )
                        }
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition',
                          selected ? 'bg-signal-soft' : 'hover:bg-surface-2',
                        )}
                      >
                        <Avatar user={person} size="sm" online={online.has(person._id)} showStatus />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{person.name}</span>
                        <span
                          className={cn(
                            'grid h-5 w-5 place-items-center rounded-md border transition',
                            selected ? 'border-signal bg-signal text-self-ink' : 'border-line-strong',
                          )}
                        >
                          {selected && <LuCheck className="h-3 w-3" strokeWidth={3} />}
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        </form>
      )}
    </Modal>
  )
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition',
        active ? 'bg-elev text-ink shadow-lift' : 'text-ink-3 hover:text-ink',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}
