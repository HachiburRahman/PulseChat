import { cn } from '@/utils/cn'
import { Spinner } from './Spinner'

const VARIANTS = {
  signal:
    'bg-self text-self-ink border-transparent hover:brightness-110 active:brightness-95 shadow-lift',
  outline: 'border-line-strong text-ink hover:bg-surface-2 hover:border-signal/50',
  ghost: 'border-transparent text-ink-2 hover:text-ink hover:bg-surface-2',
  ai: 'bg-ai-soft text-ai border-ai/30 hover:bg-ai/20',
  danger: 'bg-danger-soft text-danger border-danger/30 hover:bg-danger/20',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-sm gap-2.5 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
}

export function Button({
  as: Tag = 'button',
  variant = 'outline',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}) {
  return (
    <Tag
      className={cn(
        'no-tap inline-flex shrink-0 items-center justify-center border font-medium',
        'transition-[background,color,border-color,filter,transform] duration-150',
        'disabled:pointer-events-none disabled:opacity-45 active:translate-y-px',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={Tag === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : children}
    </Tag>
  )
}
