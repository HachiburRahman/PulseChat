import { LuChevronLeft, LuHash, LuSearch, LuUsers, LuNotebookPen } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useChat } from '@/hooks/useChat'
import { roomTitle, roomPeer, lastSeenLabel } from '@/utils/format'
import { ROUTES } from '@/utils/constants'
import { Avatar, AvatarStack } from './Avatar'
import { SignalBars } from './Logo'
import { OnlineBadge } from './OnlineBadge'

export function ChatHeader({ room, onBack, onToggleSearch, searchOpen }) {
  const { user } = useAuth()
  const { online, typing, streams } = useChat()

  const peer = roomPeer(room, user?._id)
  const title = roomTitle(room, user?._id)
  const typers = Object.values(typing[room._id] || {})
  const thinking = Boolean(streams[room._id])

  const onlineMembers = room.isGroup
    ? room.members?.filter((m) => online.has(m._id)).length || 0
    : 0

  let status
  if (typers.length) {
    status = (
      <span className="text-signal">
        {typers.length === 1 ? `${typers[0].name?.split(' ')[0]} is typing…` : 'Several people typing…'}
      </span>
    )
  } else if (thinking) {
    status = <span className="text-ai">Pulse AI is responding…</span>
  } else if (room.isAiRoom) {
    status = <span className="text-ai">Always on · replies stream live</span>
  } else if (room.isGroup) {
    status = `${room.members?.length || 0} members · ${onlineMembers} online`
  } else {
    status = online.has(peer?._id) ? (
      <span className="text-online">Online now</span>
    ) : (
      lastSeenLabel(peer?.lastSeen)
    )
  }

  return (
    <header className="relative z-20 shrink-0 border-b border-line bg-elev/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
        <button
          onClick={onBack}
          aria-label="Back to conversations"
          className="no-tap -ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink lg:hidden"
        >
          <LuChevronLeft className="h-5 w-5" />
        </button>

        {room.isGroup ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 text-signal">
            <LuHash className="h-5 w-5" />
          </span>
        ) : (
          <Avatar user={peer} size="md" online={online.has(peer?._id)} showStatus />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-[0.9375rem] font-semibold leading-tight">
            <span className="truncate">{title}</span>
            {room.isAiRoom && (
              <span className="label shrink-0 rounded border border-ai/30 bg-ai-soft px-1.5 py-0.5 !text-[0.55rem] !text-ai">
                AI
              </span>
            )}
          </h1>
          <p className="mt-0.5 truncate text-xs text-ink-3">{status}</p>
        </div>

        <div className="flex items-center gap-1">
          {room.isGroup && (
            <span className="mr-1 hidden md:block">
              <AvatarStack users={room.members || []} max={4} />
            </span>
          )}

          <HeaderBtn
            label="Search this conversation"
            onClick={onToggleSearch}
            active={searchOpen}
          >
            <LuSearch className="h-[18px] w-[18px]" />
          </HeaderBtn>

          {room.isGroup && (
            <HeaderBtn
              as={Link}
              to={ROUTES.notes(room._id)}
              label="Open the shared notes for this room"
            >
              <LuNotebookPen className="h-[18px] w-[18px]" />
            </HeaderBtn>
          )}

          {room.isGroup && (
            <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 sm:inline-flex">
              <LuUsers className="h-3.5 w-3.5 text-ink-3" />
              <span className="font-mono text-[0.6875rem] tabular-nums text-ink-2">
                {room.members?.length || 0}
              </span>
              <OnlineBadge online={onlineMembers > 0} size="sm" ring={false} />
            </span>
          )}
        </div>
      </div>

      {/* The signal strip — alive only while something is actually happening. */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px overflow-hidden">
        <div
          className={cn(
            'h-full w-full transition-opacity duration-500',
            typers.length || thinking ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            background: `linear-gradient(90deg, transparent, ${
              thinking ? 'var(--ai)' : 'var(--signal)'
            }, transparent)`,
          }}
        />
      </div>

      {(typers.length > 0 || thinking) && (
        <SignalBars
          count={40}
          height={10}
          className={cn(
            'pointer-events-none absolute inset-x-0 -bottom-2.5 opacity-30',
            thinking ? 'text-ai' : 'text-signal',
          )}
        />
      )}
    </header>
  )
}

function HeaderBtn({ as: Tag = 'button', label, active, children, ...rest }) {
  return (
    <Tag
      title={label}
      aria-label={label}
      className={cn(
        'no-tap grid h-9 w-9 shrink-0 place-items-center rounded-xl transition',
        active ? 'bg-signal-soft text-signal' : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}
