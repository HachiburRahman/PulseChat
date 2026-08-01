import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { LuArrowDown, LuMessageSquareDashed, LuRotateCw, LuTriangleAlert } from 'react-icons/lu'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { dayLabel, sameDay } from '@/utils/format'
import { cn } from '@/utils/cn'
import { MessageBubble, StreamingBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { MessageSkeleton } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'
import { Button } from './ui/Button'

const GROUP_WINDOW = 5 * 60_000

export function MessageList({ roomId, emptyState }) {
  const { user } = useAuth()
  const {
    messages,
    history,
    loadOlder,
    retryHistory,
    typing,
    streams,
    stopStream,
    askAi,
    markRead,
    online,
  } = useChat()

  const list = useMemo(() => messages[roomId] || [], [messages, roomId])
  const state = history[roomId] || {}
  const stream = streams[roomId]
  const people = typing[roomId] || {}

  // The prompt that produced the trailing AI answer, if that is where we are.
  const regeneratePrompt = useMemo(() => {
    if (!list.at(-1)?.isAi) return null
    for (let i = list.length - 2; i >= 0; i--) {
      if (list[i].isAi) continue
      return list[i].type === 'text' ? list[i].content : null
    }
    return null
  }, [list])

  const { ref, pinned, scrollToBottom } = useAutoScroll([
    roomId,
    list.length,
    stream?.text?.length,
    Object.keys(people).length,
  ])

  // ── keep the viewport still while older messages are prepended ────
  const anchor = useRef(null)
  const restoring = useRef(false)

  const handleLoadOlder = useCallback(() => {
    const el = ref.current
    if (!el || state.loading) return
    anchor.current = el.scrollHeight - el.scrollTop
    restoring.current = true
    loadOlder(roomId)
  }, [ref, state.loading, loadOlder, roomId])

  useLayoutEffect(() => {
    if (!restoring.current || state.loading) return
    const el = ref.current
    if (el && anchor.current != null) el.scrollTop = el.scrollHeight - anchor.current
    restoring.current = false
  }, [ref, list.length, state.loading])

  // Auto-fetch the previous page when the top sentinel scrolls into view.
  const sentinel = useRef(null)
  useEffect(() => {
    const node = sentinel.current
    if (!node || !state.hasMore || state.loading) return
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && handleLoadOlder(),
      { root: ref.current, rootMargin: '160px 0px 0px 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [ref, state.hasMore, state.loading, handleLoadOlder])

  // ── read receipts ─────────────────────────────────────────────────
  useEffect(() => {
    const latest = list[list.length - 1]
    if (!latest || !user || latest.pending) return
    const senderId = latest.sender?._id || latest.sender
    if (senderId === user._id) return
    if (latest.readBy?.includes(user._id)) return
    markRead(roomId, latest._id)
  }, [list, user, roomId, markRead])

  if (!state.loaded && state.loading) return <MessageSkeleton />

  if (state.error) {
    return (
      <EmptyState
        icon={LuTriangleAlert}
        title="Could not load this conversation"
        body={state.error}
        action={
          <Button variant="outline" size="sm" onClick={() => retryHistory(roomId)}>
            <LuRotateCw className="h-3.5 w-3.5" /> Try again
          </Button>
        }
      />
    )
  }

  const showEmpty = !list.length && !stream

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-4xl px-4 pb-4 pt-6 sm:px-8">
          {state.hasMore && (
            <div ref={sentinel} className="mb-6 flex justify-center">
              <Button variant="ghost" size="sm" loading={state.loading} onClick={handleLoadOlder}>
                Load earlier messages
              </Button>
            </div>
          )}

          {showEmpty
            ? (emptyState ?? (
                <EmptyState
                  icon={LuMessageSquareDashed}
                  title="No messages yet"
                  body="Say something — it lands on everyone's screen the moment you hit send."
                  className="py-24"
                />
              ))
            : list.map((message, i) => {
                const prev = list[i - 1]
                const mine = (message.sender?._id || message.sender) === user?._id
                const newDay = !prev || !sameDay(prev.createdAt, message.createdAt)
                const grouped =
                  !newDay &&
                  !message.isAi &&
                  !prev?.isAi &&
                  (prev?.sender?._id || prev?.sender) === (message.sender?._id || message.sender) &&
                  new Date(message.createdAt) - new Date(prev.createdAt) < GROUP_WINDOW

                return (
                  <Fragment key={message._id}>
                    {newDay && <DayDivider value={message.createdAt} />}
                    <div
                      id={`msg-${message._id}`}
                      className={cn(
                        'scroll-mt-24 rounded-2xl transition-colors duration-700',
                        message.isAi && 'mt-4',
                      )}
                    >
                      <MessageBubble
                        message={message}
                        mine={mine}
                        grouped={grouped}
                        online={online.has(message.sender?._id || message.sender)}
                      />
                    </div>
                  </Fragment>
                )
              })}

          {stream && (
            <div className="mt-4">
              <StreamingBubble text={stream.text} onStop={() => stopStream(roomId)} />
            </div>
          )}

          {/* Re-ask the question behind the last AI answer. */}
          {!stream && regeneratePrompt && (
            <div className="mt-3 flex justify-start pl-0 sm:pl-12">
              <button
                onClick={() => askAi({ roomId, prompt: regeneratePrompt })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-3 transition hover:border-ai/40 hover:text-ai"
              >
                <LuRotateCw className="h-3 w-3" /> Regenerate
              </button>
            </div>
          )}
        </div>
      </div>

      <TypingIndicator people={people} />

      {/* Jump-to-latest: only appears once the reader has scrolled away. */}
      <button
        onClick={() => scrollToBottom()}
        aria-hidden={pinned}
        tabIndex={pinned ? -1 : 0}
        className={cn(
          'absolute bottom-4 left-1/2 z-20 -translate-x-1/2 no-tap',
          'inline-flex items-center gap-2 rounded-full border border-line-strong',
          'glass px-3.5 py-2 text-xs font-medium text-ink shadow-pop',
          'transition-all duration-200',
          pinned
            ? 'pointer-events-none translate-y-3 opacity-0'
            : 'translate-y-0 opacity-100 hover:border-signal/50',
        )}
      >
        <LuArrowDown className="h-3.5 w-3.5 text-signal" />
        Jump to latest
      </button>
    </div>
  )
}

function DayDivider({ value }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="label rounded-full border border-line bg-surface px-3 py-1">
        {dayLabel(value)}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
