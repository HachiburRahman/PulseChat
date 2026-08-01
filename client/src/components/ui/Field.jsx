import { useId, useState } from 'react'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import { cn } from '@/utils/cn'

export function Field({
  label,
  hint,
  error,
  icon: Icon,
  type = 'text',
  className,
  inputClassName,
  ...rest
}) {
  const id = useId()
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label htmlFor={id} className="label block">
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || hint ? `${id}-note` : undefined}
          className={cn(
            'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink',
            'placeholder:text-ink-3/80 transition-colors duration-150',
            'hover:border-line-strong focus:border-signal focus:outline-none',
            'focus:ring-4 focus:ring-signal/15',
            Icon && 'pl-10',
            isPassword && 'pr-11',
            error && 'border-danger/60 focus:border-danger focus:ring-danger/15',
            inputClassName,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <LuEyeOff className="h-4 w-4" /> : <LuEye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {(error || hint) && (
        <p id={`${id}-note`} className={cn('text-xs', error ? 'text-danger' : 'text-ink-3')}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
