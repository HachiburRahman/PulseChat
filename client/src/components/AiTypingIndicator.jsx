import { Meter } from './ui/Spinner'
import { cn } from '@/utils/cn'

/**
 * Sits between the question and the first streamed token, so the gap while the
 * provider warms up never reads as a frozen UI.
 */
export function AiTypingIndicator({ className }) {
  return (
    <div className={cn('flex items-center gap-2.5 animate-fade', className)}>
      <Meter className="h-3.5 text-ai" bars={4} />
      <span className="label !text-ai/80">Pulse AI is thinking</span>
      <span className="relative h-px flex-1 overflow-hidden rounded-full bg-line">
        <span
          className="absolute inset-y-0 w-1/3 bg-ai/70 animate-sweep"
          style={{ animationDuration: '1.8s' }}
        />
      </span>
    </div>
  )
}
