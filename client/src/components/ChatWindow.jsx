import { useMemo, useState } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'
import { useChat } from '@/hooks/useChat'
import { useAuth } from '@/hooks/useAuth'
import { clockTime, shortStamp } from '@/utils/format'
import { cn } from '@/utils/cn'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'

export function ChatWindow({ room, onBack, emptyState }) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-bg">
      <ChatHeader
        room={room}
        onBack={onBack}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((v) => !v)}
      />

      {searchOpen && <ConversationSearch roomId={room._id} onClose={() => setSearchOpen(false)} />}

      <MessageList roomId={room._id} emptyState={emptyState} />
      <MessageInput key={room._id} roomId={room._id} isAiRoom={room.isAiRoom} />
    </section>
  )
}

/**
 * Searches the history already loaded in this room — no extra round trip.
 * Selecting a hit scrolls it into view and flashes it.
 */
function ConversationSearch({ roomId, onClose }) {
  const { messages } = useChat()
  const { user } = useAuth()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return (messages[roomId] || [])
      .filter((m) => m.type === 'text' && m.content?.toLowerCase().includes(q))
      .slice(-40)
      .reverse()
  }, [messages, roomId, query])

  const jumpTo = (id) => {
    const node = document.getElementById(`msg-${id}`)
    if (!node) return
    node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node.style.backgroundColor = 'var(--signal-soft)'
    setTimeout(() => {
      node.style.backgroundColor = ''
    }, 1600)
  }

  return (
    <div className="shrink-0 border-b border-line bg-elev/90 backdrop-blur-xl animate-fade">
      <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-8">
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Search in this conversation…"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-ink-3/80 focus:border-signal/60 focus:outline-none focus:ring-4 focus:ring-signal/10"
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>

        {query.trim().length >= 2 && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink-3">
                No messages matching “{query}” in the history loaded so far.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {results.map((m) => (
                  <li key={m._id}>
                    <button
                      onClick={() => jumpTo(m._id)}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-surface-2"
                    >
                      <span
                        className={cn(
                          'label mt-0.5 shrink-0',
                          m.isAi && '!text-ai',
                          (m.sender?._id || m.sender) === user?._id && '!text-signal',
                        )}
                      >
                        {m.isAi ? 'AI' : (m.sender?.name?.split(' ')[0] ?? '—')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{m.content}</span>
                      <span className="shrink-0 font-mono text-[0.625rem] text-ink-3">
                        {shortStamp(m.createdAt) === clockTime(m.createdAt)
                          ? clockTime(m.createdAt)
                          : shortStamp(m.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
