import { cn } from '@/utils/cn'

export function Skeleton({ className, ...rest }) {
  return <div className={cn('animate-shimmer rounded-lg bg-surface-2', className)} {...rest} />
}

export function ConversationSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-1 px-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl p-3" style={{ opacity: 1 - i * 0.13 }}>
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MessageSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-8" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => {
        const mine = i % 3 === 2
        return (
          <div key={i} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
            <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
            <div className={cn('space-y-2', mine && 'items-end')}>
              <Skeleton className="h-3 w-24" />
              <Skeleton
                className="h-12 rounded-2xl"
                style={{ width: `${180 + ((i * 67) % 190)}px` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
