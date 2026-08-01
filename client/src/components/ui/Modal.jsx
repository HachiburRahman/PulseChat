import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'
import { cn } from '@/utils/cn'

export function Modal({ open, onClose, title, subtitle, children, footer, className }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-bg-deep/70 backdrop-blur-sm animate-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-t-3xl border border-line',
          'bg-elev shadow-pop animate-rise outline-none sm:rounded-3xl',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
          >
            <LuX className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-surface/50 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
