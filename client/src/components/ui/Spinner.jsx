import { cn } from '@/utils/cn'

export function Spinner({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('h-5 w-5 animate-spin', className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Three-bar level meter — the app's stand-in for a loading dot trio. */
export function Meter({ className, bars = 3 }) {
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-[3px]', className)} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-current animate-eq"
          style={{ height: '100%', animationDelay: `${i * 130}ms` }}
        />
      ))}
    </span>
  )
}
