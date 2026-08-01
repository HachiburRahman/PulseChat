import { LuFlaskConical } from 'react-icons/lu'

/**
 * Demo mode is honest about itself — no one should mistake fixtures for a
 * running backend. Shown on the auth screens and as a chip in the app shell.
 */
export function DemoNotice() {
  return (
    <div className="rounded-xl border border-signal/25 bg-signal-soft px-3.5 py-3">
      <p className="flex items-center gap-2 text-xs font-medium text-signal">
        <LuFlaskConical className="h-3.5 w-3.5" />
        Demo mode — no backend required
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
        Any email and password will sign you in against in-memory fixtures. Set{' '}
        <code className="rounded border border-line bg-surface px-1 font-mono text-[0.6875rem]">
          VITE_DEMO_MODE=false
        </code>{' '}
        once the Express server is running.
      </p>
    </div>
  )
}

export function DemoChip() {
  return (
    <span
      title="Running against in-memory fixtures — set VITE_DEMO_MODE=false to use the real API"
      className="inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal-soft px-2 py-0.5"
    >
      <LuFlaskConical className="h-3 w-3 text-signal" />
      <span className="label !text-[0.5625rem] !text-signal">demo</span>
    </span>
  )
}
