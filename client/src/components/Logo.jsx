import { cn } from '@/utils/cn'

const TRACE = 'M2 16h4.6l2.7-8.6 4.7 17.2L18.2 12l2.3 4.6H30'

/** The mark: a single heartbeat drawn across the chassis. */
export function Logo({ size = 38, animate = true, className }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-xl',
        'border border-line-strong bg-bg-deep',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(70% 120% at 50% 130%, var(--signal), transparent 70%)',
        }}
      />
      <svg viewBox="0 0 32 32" className="relative h-[70%] w-[70%] text-signal" fill="none">
        <path
          d={TRACE}
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="100"
          strokeDasharray="100"
          style={animate ? { animation: 'trace 2.8s ease-in-out infinite' } : undefined}
        />
      </svg>
    </span>
  )
}

export function Wordmark({ className, size = 38 }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <Logo size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.05rem] font-semibold tracking-tight text-ink">
          Pulse<span className="text-signal">Chat</span>
        </span>
        <span className="label mt-1">live · v0.1</span>
      </span>
    </span>
  )
}

/**
 * A row of level-meter bars. Decorative, but it is the motif that ties the
 * header, the auth hero and the typing indicator together.
 */
export function SignalBars({ count = 28, className, height = 22, speed = 1.4 }) {
  return (
    <span
      className={cn('flex items-end gap-[3px]', className)}
      style={{ height }}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="w-[2px] flex-1 origin-bottom rounded-full bg-current"
          style={{
            height: '100%',
            animation: `eq ${speed + (i % 5) * 0.16}s ease-in-out ${i * 55}ms infinite`,
            opacity: 0.25 + ((i * 37) % 60) / 100,
          }}
        />
      ))}
    </span>
  )
}
