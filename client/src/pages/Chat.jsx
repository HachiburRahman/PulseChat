import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LuMessagesSquare, LuSearchX, LuSparkles } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useChat } from '@/hooks/useChat'
import { Sidebar } from '@/components/Sidebar'
import { ChatWindow } from '@/components/ChatWindow'
import { SignalBars } from '@/components/Logo'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { MessageSkeleton } from '@/components/ui/Skeleton'
import { ROUTES } from '@/utils/constants'

export default function Chat() {
  const { roomId } = useParams()
  const { rooms, roomsLoading, openRoom } = useChat()
  const navigate = useNavigate()

  useEffect(() => {
    openRoom(roomId || null)
  }, [roomId, openRoom])

  const room = rooms.find((r) => r._id === roomId)

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* On phones the list and the conversation are two screens, not two panes. */}
      <div
        className={cn(
          'h-full min-h-0 w-full lg:w-[22rem] lg:shrink-0 xl:w-[23.5rem]',
          roomId && 'hidden lg:block',
        )}
      >
        <Sidebar />
      </div>

      <div className={cn('h-full min-h-0 min-w-0 flex-1', !roomId && 'hidden lg:flex')}>
        {roomId ? (
          room ? (
            <ChatWindow room={room} onBack={() => navigate(ROUTES.chat)} />
          ) : roomsLoading ? (
            <div className="flex-1">
              <MessageSkeleton />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={LuSearchX}
                title="Conversation not found"
                body="It may have been deleted, or you are no longer a member."
                action={
                  <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.chat)}>
                    Back to conversations
                  </Button>
                }
              />
            </div>
          )
        ) : (
          <NoRoomSelected />
        )}
      </div>
    </div>
  )
}

function NoRoomSelected() {
  const navigate = useNavigate()

  return (
    <div className="field relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-bg px-8 text-center">
      <SignalBars
        count={64}
        height={120}
        speed={2.2}
        className="pointer-events-none absolute inset-x-0 bottom-0 text-signal opacity-[0.07]"
      />

      <div className="relative max-w-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-surface text-signal">
          <LuMessagesSquare className="h-6 w-6" />
        </span>

        <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight">
          Pick up where you left off
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-3">
          Choose a conversation on the left, or ask the assistant something — replies stream in as
          they are generated.
        </p>

        <Button
          variant="ai"
          size="md"
          className="mt-7"
          onClick={() => navigate(ROUTES.ai)}
        >
          <LuSparkles className="h-4 w-4" /> Ask Pulse AI
        </Button>

        <p className="mt-8 text-[0.6875rem] text-ink-3">
          Tip: type{' '}
          <kbd className="rounded border border-line bg-surface px-1 font-mono text-[0.625rem] text-signal">
            @ai
          </kbd>{' '}
          in any room to bring the assistant into the conversation.
        </p>
      </div>
    </div>
  )
}
