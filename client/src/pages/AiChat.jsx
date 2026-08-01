import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuSparkles, LuTriangleAlert } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useChat } from '@/hooks/useChat'
import { Sidebar } from '@/components/Sidebar'
import { ChatWindow } from '@/components/ChatWindow'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import { ROUTES } from '@/utils/constants'

const SUGGESTIONS = [
  'Explain the WebSocket handshake like I am in an interview.',
  'Review my Mongoose schema for chat messages.',
  'How should I paginate message history efficiently?',
  'Write a README intro for this project.',
]

export default function AiChat() {
  const { rooms, roomsLoading, directory, openDm, openRoom, sendMessage } = useChat()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  const aiRoom = useMemo(() => rooms.find((r) => r.isAiRoom), [rooms])
  const bot = useMemo(() => directory.find((u) => u.isBot), [directory])

  // No AI room yet? Open the DM with the bot exactly like any other person.
  useEffect(() => {
    if (aiRoom || roomsLoading || !bot) return
    let cancelled = false
    openDm(bot._id).catch((err) => {
      if (!cancelled) setError(err.friendly || 'Could not reach the assistant.')
    })
    return () => {
      cancelled = true
    }
  }, [aiRoom, roomsLoading, bot, openDm])

  useEffect(() => {
    if (aiRoom) openRoom(aiRoom._id)
  }, [aiRoom, openRoom])

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="hidden h-full min-h-0 lg:block lg:w-[22rem] lg:shrink-0 xl:w-[23.5rem]">
        <Sidebar />
      </div>

      <div className="flex h-full min-h-0 min-w-0 flex-1">
        {aiRoom ? (
          <ChatWindow
            room={aiRoom}
            onBack={() => navigate(ROUTES.chat)}
            emptyState={
              <AiWelcome onPick={(prompt) => sendMessage({ roomId: aiRoom._id, content: prompt })} />
            }
          />
        ) : error ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={LuTriangleAlert}
              tone="ai"
              title="Assistant unavailable"
              body={error}
              action={
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.chat)}>
                  Back to conversations
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex-1">
            <MessageSkeleton rows={3} />
          </div>
        )}
      </div>
    </div>
  )
}

function AiWelcome({ onPick }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-14 text-center">
      <span className="relative">
        <span
          className="absolute -inset-4 rounded-full opacity-25 blur-2xl"
          style={{ background: 'var(--ai)' }}
        />
        <Avatar user={{ isBot: true, name: 'Pulse AI' }} size="xl" className="relative" />
      </span>

      <h2 className="mt-7 font-display text-2xl font-semibold tracking-tight">
        Ask Pulse AI anything
      </h2>
      <p className="mt-2.5 text-sm leading-relaxed text-ink-3">
        Replies stream token by token over the socket, and the assistant remembers the last few
        messages of this conversation for context.
      </p>

      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((prompt, i) => (
          <button
            key={prompt}
            onClick={() => onPick(prompt)}
            className={cn(
              'group rounded-2xl border border-line bg-surface p-3.5 text-left transition animate-fade',
              'hover:-translate-y-0.5 hover:border-ai/40 hover:bg-ai-soft/40',
            )}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <LuSparkles className="h-3.5 w-3.5 text-ai transition group-hover:scale-110" />
            <span className="mt-2.5 block text-xs leading-relaxed text-ink-2 group-hover:text-ink">
              {prompt}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-[0.6875rem] leading-relaxed text-ink-3">
        The provider key stays on the server — the browser only ever sees the streamed text.
      </p>
    </div>
  )
}
