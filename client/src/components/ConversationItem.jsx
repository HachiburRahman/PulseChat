import { NavLink } from 'react-router-dom'
import { LuHash, LuSparkles } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { roomTitle, roomPeer, previewOf, shortStamp } from '@/utils/format'
import { ROUTES } from '@/utils/constants'
import { Avatar } from './Avatar'
import { Meter } from './ui/Spinner'

export function ConversationItem({ room, meId, online, unread = 0, typing = {}, streaming }) {
  const peer = roomPeer(room, meId)
  const title = roomTitle(room, meId)
  const typers = Object.values(typing)
  const isOnline = room.isAiRoom || (peer ? online.has(peer._id) : false)

  return (
    <NavLink
      to={ROUTES.room(room._id)}
      className={({ isActive }) =>
        cn(
          'no-tap group relative flex items-center gap-3 rounded-2xl px-3 py-2.5',
          'transition-colors duration-150',
          isActive ? 'bg-surface-2' : 'hover:bg-surface/70',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200',
              isActive ? 'bg-signal opacity-100' : 'opacity-0',
            )}
          />

          {room.isGroup ? (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 text-ink-2 transition group-hover:text-signal">
              <LuHash className="h-[18px] w-[18px]" />
            </span>
          ) : (
            <Avatar
              user={room.isAiRoom ? { isBot: true, name: 'Pulse AI' } : peer}
              size="md"
              online={isOnline}
              showStatus
            />
          )}

          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  'truncate text-sm',
                  unread > 0 ? 'font-semibold text-ink' : 'font-medium text-ink',
                )}
              >
                {title}
              </span>
              {room.isAiRoom && <LuSparkles className="h-3 w-3 shrink-0 text-ai" />}
              <span className="ml-auto shrink-0 font-mono text-[0.625rem] tabular-nums text-ink-3">
                {shortStamp(room.lastMessage?.createdAt || room.updatedAt)}
              </span>
            </span>

            <span className="mt-0.5 flex items-center gap-2">
              {typers.length ? (
                <span className="flex items-center gap-1.5 text-xs text-signal">
                  <Meter className="h-2.5" />
                  typing
                </span>
              ) : streaming ? (
                <span className="flex items-center gap-1.5 text-xs text-ai">
                  <Meter className="h-2.5" />
                  responding
                </span>
              ) : (
                <span
                  className={cn(
                    'truncate text-xs',
                    unread > 0 ? 'text-ink-2' : 'text-ink-3',
                  )}
                >
                  {previewOf(room.lastMessage, meId)}
                </span>
              )}

              {unread > 0 && (
                <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-self px-1.5 font-mono text-[0.625rem] font-medium tabular-nums text-self-ink">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
          </span>
        </>
      )}
    </NavLink>
  )
}
