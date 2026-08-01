import { cn } from '@/utils/cn'

export function EmptyState({ icon: Icon, title, body, action, tone = 'signal', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-8 py-14 text-center', className)}>
      {Icon && (
        <div
          className={cn(
            'mb-5 grid h-14 w-14 place-items-center rounded-2xl border',
            tone === 'ai' ? 'border-ai/25 bg-ai-soft text-ai' : 'border-line bg-surface-2 text-signal',
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-3">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
