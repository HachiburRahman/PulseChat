import { cn } from '@/utils/cn'

const SIZES = { sm: 'h-2 w-2', md: 'h-2.5 w-2.5', lg: 'h-3 w-3' }

/** Presence dot — it breathes while the user is live, sits flat when not. */
export function OnlineBadge({ online, size = 'md', ring = true, className, label }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full',
        SIZES[size],
        ring && 'ring-2 ring-elev',
        online ? 'bg-online animate-halo' : 'bg-ink-3/50',
        className,
      )}
      title={label || (online ? 'Online' : 'Offline')}
      aria-label={label || (online ? 'Online' : 'Offline')}
      role="img"
    />
  )
}
