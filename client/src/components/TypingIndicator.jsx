import { Avatar } from './Avatar'
import { Meter } from './ui/Spinner'
import { cn } from '@/utils/cn'

/** `people` is the map ChatContext keeps per room: { userId: user }. */
export function TypingIndicator({ people = {}, className }) {
  const list = Object.values(people)
  if (!list.length) return null

  const names = list.map((p) => p.name?.split(' ')[0] || 'Someone')
  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`

  return (
    <div className={cn('flex items-center gap-3 px-4 pb-2 sm:px-8 animate-fade', className)}>
      <span className="flex -space-x-2">
        {list.slice(0, 3).map((p) => (
          <Avatar key={p._id} user={p} size="xs" className="ring-2 ring-bg rounded-lg" />
        ))}
      </span>
      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5">
        <Meter className="text-signal h-3" />
        <span className="text-xs text-ink-2">{label}</span>
      </span>
    </div>
  )
}
