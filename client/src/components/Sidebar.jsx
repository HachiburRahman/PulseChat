import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LuHash,
  LuLogOut,
  LuMessagesSquare,
  LuMoon,
  LuPlus,
  LuRotateCw,
  LuSearch,
  LuSparkles,
  LuSun,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useChat } from '@/hooks/useChat'
import { useSocket } from '@/hooks/useSocket'
import { useTheme } from '@/hooks/useTheme'
import { roomTitle, previewOf } from '@/utils/format'
import { ROUTES } from '@/utils/constants'
import { ConversationItem } from './ConversationItem'
import { NewChatModal } from './NewChatModal'
import { DemoChip } from './DemoNotice'
import { Avatar } from './Avatar'
import { Wordmark } from './Logo'
import { Button } from './ui/Button'
import { ConversationSkeleton } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'

export function Sidebar({ className }) {
  const { user, demo, logout } = useAuth()
  const { status } = useSocket()
  const { isDark, toggle: toggleTheme } = useTheme()
  const {
    rooms,
    roomsLoading,
    roomsError,
    refreshRooms,
    online,
    unread,
    typing,
    streams,
    directory,
    openDm,
  } = useChat()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [newChatOpen, setNewChatOpen] = useState(false)

  const aiRoom = useMemo(() => rooms.find((r) => r.isAiRoom), [rooms])

  const { channels, directs } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const visible = rooms.filter((room) => {
      if (room.isAiRoom) return false
      if (!q) return true
      return (
        roomTitle(room, user?._id).toLowerCase().includes(q) ||
        previewOf(room.lastMessage, user?._id).toLowerCase().includes(q)
      )
    })
    return {
      channels: visible.filter((r) => r.isGroup),
      directs: visible.filter((r) => !r.isGroup),
    }
  }, [rooms, query, user])

  const onlineNow = useMemo(
    () => directory.filter((u) => !u.isBot && online.has(u._id)),
    [directory, online],
  )

  const startDm = async (userId) => {
    const room = await openDm(userId)
    navigate(ROUTES.room(room._id))
  }

  const empty = !roomsLoading && !channels.length && !directs.length

  return (
    <aside
      className={cn('flex h-full min-h-0 w-full flex-col border-r border-line bg-elev', className)}
    >
      {/* -- header ------------------------------------------------- */}
      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <Wordmark size={34} />
          {demo && <DemoChip />}
          <Button
            variant="signal"
            size="icon-sm"
            onClick={() => setNewChatOpen(true)}
            aria-label="Start a new conversation"
            title="New conversation"
          >
            <LuPlus className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </div>

        <div className="relative mt-4">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-3/80 transition hover:border-line-strong focus:border-signal/60 focus:outline-none focus:ring-4 focus:ring-signal/10"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            >
              <LuX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* -- the AI, given its own pedestal ------------------------- */}
      {aiRoom && !query && (
        <div className="shrink-0 px-3 pb-1">
          <button
            onClick={() => navigate(ROUTES.ai)}
            className="group relative w-full overflow-hidden rounded-2xl border border-ai/25 bg-ai-soft px-3.5 py-3 text-left transition hover:border-ai/45"
          >
            <span
              className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl transition group-hover:opacity-50"
              style={{ background: 'var(--ai)' }}
            />
            <span className="relative flex items-center gap-3">
              <Avatar user={{ isBot: true, name: 'Pulse AI' }} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-display text-sm font-semibold text-ink">
                    Ask Pulse AI
                  </span>
                  <LuSparkles className="h-3 w-3 shrink-0 text-ai" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-3">
                  {streams[aiRoom._id] ? 'Streaming a reply…' : 'Answers stream in live'}
                </span>
              </span>
              {unread[aiRoom._id] > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ai px-1.5 font-mono text-[0.625rem] text-bg-deep">
                  {unread[aiRoom._id]}
                </span>
              )}
            </span>
          </button>
        </div>
      )}

      {/* -- online strip ------------------------------------------- */}
      {onlineNow.length > 0 && !query && (
        <div className="shrink-0 px-4 pb-2 pt-3">
          <p className="label mb-2">Online · {onlineNow.length}</p>
          <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {onlineNow.map((person) => (
              <button
                key={person._id}
                onClick={() => startDm(person._id)}
                title={`Message ${person.name}`}
                className="shrink-0 transition hover:-translate-y-0.5"
              >
                <Avatar user={person} size="sm" online showStatus />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -- conversation list -------------------------------------- */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {roomsLoading && <ConversationSkeleton />}

        {roomsError && (
          <EmptyState
            icon={LuTriangleAlert}
            title="Offline"
            body={roomsError}
            className="py-10"
            action={
              <Button variant="outline" size="sm" onClick={refreshRooms}>
                <LuRotateCw className="h-3.5 w-3.5" /> Retry
              </Button>
            }
          />
        )}

        {empty && !roomsError && (
          <EmptyState
            icon={query ? LuSearch : LuMessagesSquare}
            title={query ? 'Nothing matches' : 'No conversations yet'}
            body={
              query
                ? `Try a different search than “${query}”.`
                : 'Start a direct message or spin up a room to get going.'
            }
            className="py-12"
            action={
              !query && (
                <Button variant="signal" size="sm" onClick={() => setNewChatOpen(true)}>
                  <LuPlus className="h-3.5 w-3.5" /> New conversation
                </Button>
              )
            }
          />
        )}

        {channels.length > 0 && (
          <Section icon={LuHash} title="Rooms" count={channels.length}>
            {channels.map((room) => (
              <ConversationItem
                key={room._id}
                room={room}
                meId={user?._id}
                online={online}
                unread={unread[room._id]}
                typing={typing[room._id]}
                streaming={Boolean(streams[room._id])}
              />
            ))}
          </Section>
        )}

        {directs.length > 0 && (
          <Section icon={LuMessagesSquare} title="Direct messages" count={directs.length}>
            {directs.map((room) => (
              <ConversationItem
                key={room._id}
                room={room}
                meId={user?._id}
                online={online}
                unread={unread[room._id]}
                typing={typing[room._id]}
                streaming={Boolean(streams[room._id])}
              />
            ))}
          </Section>
        )}
      </nav>

      {/* -- footer -------------------------------------------------- */}
      <div className="flex shrink-0 items-center gap-1 border-t border-line px-3 py-3">
        <button
          onClick={() => navigate(ROUTES.profile)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-surface-2"
        >
          <Avatar user={user} size="sm" online={status === 'live'} showStatus />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user?.name}</span>
            <span className="label block truncate">
              {status === 'live' ? 'Connected' : status === 'down' ? 'Reconnecting…' : 'Connecting…'}
            </span>
          </span>
        </button>

        {/* On desktop these live in the rail. */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="no-tap grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-3 transition hover:bg-surface-2 hover:text-ink lg:hidden"
        >
          {isDark ? (
            <LuSun className="h-[17px] w-[17px]" />
          ) : (
            <LuMoon className="h-[17px] w-[17px]" />
          )}
        </button>
        <button
          onClick={() => {
            logout()
            navigate(ROUTES.login, { replace: true })
          }}
          aria-label="Sign out"
          className="no-tap grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-3 transition hover:bg-danger-soft hover:text-danger lg:hidden"
        >
          <LuLogOut className="h-[17px] w-[17px]" />
        </button>
      </div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </aside>
  )
}

function Section({ icon: Icon, title, count, children }) {
  return (
    <section className="mb-2">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-3">
        <Icon className="h-3 w-3 text-ink-3" />
        <span className="label">{title}</span>
        <span className="label ml-auto">{count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}
