import { useEffect } from 'react'
import { LuTriangleAlert, LuX } from 'react-icons/lu'
import { cn } from '@/utils/cn'

export function Toast({ message, onClose, tone = 'danger', timeout = 6000 }) {
  useEffect(() => {
    if (!message || !timeout) return
    const id = setTimeout(onClose, timeout)
    return () => clearTimeout(id)
  }, [message, timeout, onClose])

  if (!message) return null

  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-4 left-1/2 z-90 flex -translate-x-1/2 items-center gap-3',
        'rounded-xl border px-4 py-3 shadow-pop animate-rise sm:left-auto sm:right-6 sm:translate-x-0',
        tone === 'danger' ? 'border-danger/30 bg-danger-soft' : 'border-line glass',
      )}
    >
      <LuTriangleAlert
        className={cn('h-4 w-4 shrink-0', tone === 'danger' ? 'text-danger' : 'text-signal')}
      />
      <p className={cn('text-xs', tone === 'danger' ? 'text-danger' : 'text-ink-2')}>{message}</p>
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="-mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-3 transition hover:text-ink"
      >
        <LuX className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
