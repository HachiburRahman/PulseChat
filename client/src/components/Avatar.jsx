import { cn } from '@/utils/cn'
import { initials, hueFor } from '@/utils/format'
import { OnlineBadge } from './OnlineBadge'

const SIZES = {
  xs: 'h-7 w-7 rounded-lg text-[0.625rem]',
  sm: 'h-9 w-9 rounded-xl text-[0.6875rem]',
  md: 'h-11 w-11 rounded-2xl text-xs',
  lg: 'h-14 w-14 rounded-2xl text-sm',
  xl: 'h-24 w-24 rounded-3xl text-xl',
}

const DOT = { xs: 'sm', sm: 'sm', md: 'md', lg: 'md', xl: 'lg' }

export function Avatar({ user, size = 'md', online, showStatus = false, className }) {
  const bot = user?.isBot
  const hue = bot ? 'var(--ai)' : hueFor(user?._id || user?.name)

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'grid place-items-center overflow-hidden border font-mono font-medium uppercase tracking-wider',
          SIZES[size],
          bot ? 'border-ai/35 bg-ai-soft' : 'border-line',
        )}
        style={
          user?.avatarUrl
            ? undefined
            : {
                background: bot
                  ? undefined
                  : `linear-gradient(145deg, color-mix(in oklab, ${hue} 26%, var(--surface)), var(--surface-2))`,
                color: hue,
              }
        }
      >
        {user?.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.name || 'Avatar'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : bot ? (
          <BotGlyph />
        ) : (
          initials(user?.name)
        )}
      </span>

      {showStatus && (
        <OnlineBadge
          online={online}
          size={DOT[size]}
          className="absolute -bottom-0.5 -right-0.5"
        />
      )}
    </span>
  )
}

function BotGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[58%] w-[58%] text-ai" fill="none" aria-hidden="true">
      <path
        d="M2 12h3.4l2-6 3.4 12.6L13.4 9l1.7 3.4H22"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Overlapping stack used on group conversation rows. */
export function AvatarStack({ users = [], max = 3, size = 'xs' }) {
  const shown = users.slice(0, max)
  const rest = users.length - shown.length
  return (
    <span className="flex items-center -space-x-2">
      {shown.map((u) => (
        <Avatar key={u._id} user={u} size={size} className="ring-2 ring-elev rounded-lg" />
      ))}
      {rest > 0 && (
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface-2 text-[0.625rem] font-mono text-ink-3 ring-2 ring-elev">
          +{rest}
        </span>
      )}
    </span>
  )
}
