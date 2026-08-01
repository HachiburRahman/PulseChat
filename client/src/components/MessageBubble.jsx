import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LuCheck, LuCheckCheck, LuClock3, LuDownload, LuFile, LuSparkles } from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { clockTime } from '@/utils/format'
import { Avatar } from './Avatar'
import { AiTypingIndicator } from './AiTypingIndicator'

/* ── shared pieces ─────────────────────────────────────────────────── */

function Receipt({ message, mine }) {
  if (!mine) return null
  if (message.pending) return <LuClock3 className="h-3 w-3 opacity-60" aria-label="Sending" />
  const seen = (message.readBy?.length || 0) > 1
  return seen ? (
    <LuCheckCheck className="h-3.5 w-3.5" aria-label="Seen" />
  ) : (
    <LuCheck className="h-3.5 w-3.5 opacity-60" aria-label="Delivered" />
  )
}

function Attachment({ message, mine }) {
  if (message.type === 'image') {
    return (
      <a
        href={message.content}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-xl border border-line/60"
      >
        <img
          src={message.content}
          alt={message.fileName || 'Shared image'}
          className="max-h-72 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
          loading="lazy"
        />
      </a>
    )
  }

  return (
    <a
      href={message.content}
      target="_blank"
      rel="noreferrer"
      download={message.fileName}
      className={cn(
        'group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition',
        mine ? 'border-current/20 hover:border-current/40' : 'border-line hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
          mine ? 'bg-current/10' : 'bg-surface-2',
        )}
      >
        <LuFile className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {message.fileName || 'Attachment'}
      </span>
      <LuDownload className="h-4 w-4 shrink-0 opacity-50 transition group-hover:opacity-100" />
    </a>
  )
}

/* ── AI message ────────────────────────────────────────────────────── */

function AiCard({ children, meta, streaming }) {
  return (
    <article className="animate-rise group/ai flex w-full gap-3">
      <span className="relative mt-0.5 hidden sm:block">
        <Avatar user={{ isBot: true, name: 'Pulse AI' }} size="sm" />
      </span>

      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl rounded-tl-md border border-ai/25 bg-ai-soft/60">
        <header className="flex items-center gap-2 border-b border-ai/15 px-4 py-2">
          <LuSparkles className="h-3.5 w-3.5 text-ai" />
          <span className="font-display text-sm font-semibold text-ai">Pulse AI</span>
          <span className="label rounded border border-ai/30 px-1.5 py-0.5 !text-[0.55rem] !text-ai/80">
            assistant
          </span>
          <span className="ml-auto label">{meta}</span>
        </header>
        <div className="px-4 py-3">
          {children}
          {streaming && (
            <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 bg-ai animate-caret" />
          )}
        </div>
      </div>
    </article>
  )
}

/** The live bubble that grows as `ai_stream` chunks arrive. */
export function StreamingBubble({ text, onStop }) {
  return (
    <AiCard meta="streaming" streaming>
      {text ? (
        <div className="prose-ai text-ink">
          <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </div>
      ) : (
        <AiTypingIndicator />
      )}
      {onStop && (
        <button
          onClick={onStop}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ai/30 px-2.5 py-1 text-xs text-ai transition hover:bg-ai/10"
        >
          <span className="h-2 w-2 rounded-[2px] bg-ai" />
          Stop
        </button>
      )}
    </AiCard>
  )
}

/* ── main bubble ───────────────────────────────────────────────────── */

function MessageBubbleBase({ message, mine, grouped = false, showAvatar = true, online = false }) {
  const time = clockTime(message.createdAt)

  if (message.isAi) {
    return (
      <AiCard meta={time}>
        <div className="prose-ai text-ink">
          <Markdown remarkPlugins={[remarkGfm]}>{message.content || ''}</Markdown>
        </div>
      </AiCard>
    )
  }

  const isMedia = message.type === 'image' || message.type === 'file'

  return (
    <div
      className={cn(
        'animate-rise flex w-full items-end gap-2.5',
        mine ? 'flex-row-reverse' : 'flex-row',
        grouped ? 'mt-0.5' : 'mt-4',
      )}
    >
      <span className={cn('w-9 shrink-0', mine && 'hidden sm:block')}>
        {showAvatar && !grouped ? (
          <Avatar user={message.sender} size="sm" online={online} showStatus={!mine} />
        ) : null}
      </span>

      <div className={cn('flex min-w-0 max-w-[min(85%,42rem)] flex-col', mine && 'items-end')}>
        {!grouped && !mine && (
          <span className="mb-1 px-1 font-display text-xs font-semibold text-ink-2">
            {message.sender?.name}
          </span>
        )}

        <div
          className={cn(
            'relative w-fit max-w-full px-3.5 py-2.5 text-[0.9375rem] leading-relaxed',
            'transition-shadow duration-200',
            isMedia && 'p-1.5',
            mine
              ? 'rounded-2xl rounded-br-md bg-self text-self-ink shadow-lift'
              : 'rounded-2xl rounded-bl-md border border-line bg-surface text-ink',
            message.pending && 'opacity-65',
          )}
        >
          {isMedia ? (
            <Attachment message={message} mine={mine} />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}

          <span
            className={cn(
              'mt-1 flex items-center justify-end gap-1 font-mono text-[0.625rem] tabular-nums',
              mine ? 'text-self-ink/60' : 'text-ink-3',
              isMedia && 'pr-1.5 pb-0.5',
            )}
          >
            {time}
            <Receipt message={message} mine={mine} />
          </span>
        </div>
      </div>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleBase)
