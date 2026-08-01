import { Link } from 'react-router-dom'
import { LuLockKeyhole, LuRadio, LuSparkles } from 'react-icons/lu'
import { Logo, SignalBars } from './Logo'
import { ROUTES } from '@/utils/constants'

const PILLARS = [
  { icon: LuRadio, title: 'Live presence', body: 'Green dots that survive five open tabs.' },
  { icon: LuSparkles, title: 'Streaming AI', body: 'Answers arrive token by token, in the room.' },
  { icon: LuLockKeyhole, title: 'Socket auth', body: 'Every connection carries a verified JWT.' },
]

export function AuthLayout({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="grain flex min-h-full flex-col bg-bg lg:flex-row">
      {/* ── hero ───────────────────────────────────────────────── */}
      <section className="bloom relative isolate hidden overflow-hidden border-r border-line bg-bg-deep lg:flex lg:w-[52%] lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div className="field pointer-events-none absolute inset-0 opacity-50" />

        <header className="relative flex items-center gap-3 animate-fade">
          <Logo size={42} />
          <span className="font-display text-lg font-semibold tracking-tight">
            Pulse<span className="text-signal">Chat</span>
          </span>
        </header>

        <div className="relative max-w-lg">
          <p className="label animate-fade" style={{ animationDelay: '80ms' }}>
            real-time · mern · socket.io · llm
          </p>

          <h1
            className="mt-5 font-display text-[clamp(2.5rem,4.6vw,3.9rem)] font-semibold leading-[0.98] tracking-[-0.035em] animate-fade"
            style={{ animationDelay: '160ms' }}
          >
            Every message lands
            <br />
            the <span className="text-signal">moment</span> you
            <br />
            send it.
          </h1>

          <p
            className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-ink-2 animate-fade"
            style={{ animationDelay: '240ms' }}
          >
            Rooms, direct messages, typing indicators and read receipts over one authenticated
            WebSocket — plus an assistant that answers right in the conversation.
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title: t, body }, i) => (
              <li
                key={t}
                className="rounded-2xl border border-line bg-surface/40 p-4 backdrop-blur-sm animate-fade"
                style={{ animationDelay: `${320 + i * 90}ms` }}
              >
                <Icon className="h-4 w-4 text-signal" />
                <p className="mt-3 text-sm font-medium text-ink">{t}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-3">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative flex items-end justify-between gap-6">
          <SignalBars count={44} height={30} className="max-w-xs flex-1 text-signal opacity-60" />
          <p className="label text-right">
            authenticated handshake
            <br />
            <span className="text-online">● socket ready</span>
          </p>
        </footer>
      </section>

      {/* ── form ───────────────────────────────────────────────── */}
      <section className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link to={ROUTES.chat} className="mb-10 inline-flex items-center gap-2.5 lg:hidden">
            <Logo size={36} />
            <span className="font-display text-base font-semibold tracking-tight">
              Pulse<span className="text-signal">Chat</span>
            </span>
          </Link>

          <p className="label animate-fade">{eyebrow}</p>
          <h2
            className="mt-3 font-display text-3xl font-semibold tracking-tight animate-fade"
            style={{ animationDelay: '60ms' }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="mt-2 text-sm leading-relaxed text-ink-3 animate-fade"
              style={{ animationDelay: '110ms' }}
            >
              {subtitle}
            </p>
          )}

          <div className="mt-8 animate-fade" style={{ animationDelay: '170ms' }}>
            {children}
          </div>

          {footer && (
            <div className="mt-8 animate-fade" style={{ animationDelay: '240ms' }}>
              {footer}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
