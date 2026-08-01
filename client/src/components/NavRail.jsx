import { NavLink, useNavigate } from 'react-router-dom'
import {
  LuLogOut,
  LuMessagesSquare,
  LuMoon,
  LuNotebookPen,
  LuSparkles,
  LuSun,
  LuUserRound,
} from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useChat } from '@/hooks/useChat'
import { useTheme } from '@/hooks/useTheme'
import { ROUTES } from '@/utils/constants'
import { Logo } from './Logo'

/** Desktop-only vertical rail. On small screens the sidebar carries navigation. */
export function NavRail() {
  const { logout } = useAuth()
  const { rooms, totalUnread } = useChat()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()

  const firstGroup = rooms.find((r) => r.isGroup)

  const onLogout = () => {
    logout()
    navigate(ROUTES.login, { replace: true })
  }

  return (
    <nav className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line bg-bg-deep py-4 lg:flex">
      <NavLink to={ROUTES.chat} aria-label="PulseChat home" className="mb-3">
        <Logo size={38} />
      </NavLink>

      <RailLink to={ROUTES.chat} end icon={LuMessagesSquare} label="Chats" badge={totalUnread} />
      <RailLink to={ROUTES.ai} icon={LuSparkles} label="Ask Pulse AI" tone="ai" />
      {firstGroup && (
        <RailLink to={ROUTES.notes(firstGroup._id)} icon={LuNotebookPen} label="Shared notes" />
      )}
      <RailLink to={ROUTES.profile} icon={LuUserRound} label="Profile" />

      <div className="flex-1" />

      <RailButton onClick={toggle} label={isDark ? 'Switch to light' : 'Switch to dark'}>
        {isDark ? <LuSun className="h-[18px] w-[18px]" /> : <LuMoon className="h-[18px] w-[18px]" />}
      </RailButton>
      <RailButton onClick={onLogout} label="Sign out" danger>
        <LuLogOut className="h-[18px] w-[18px]" />
      </RailButton>
    </nav>
  )
}

function RailLink({ to, end, icon: Icon, label, badge = 0, tone }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      aria-label={label}
      className={({ isActive }) =>
        cn(
          'no-tap group relative grid h-11 w-11 place-items-center rounded-2xl transition-all duration-200',
          isActive
            ? tone === 'ai'
              ? 'bg-ai-soft text-ai'
              : 'bg-signal-soft text-signal'
            : 'text-ink-3 hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute -left-4 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200',
              isActive ? (tone === 'ai' ? 'bg-ai' : 'bg-signal') : 'bg-transparent',
            )}
          />
          <Icon className="h-[19px] w-[19px]" />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-self px-1 font-mono text-[0.5625rem] font-medium tabular-nums text-self-ink ring-2 ring-bg-deep">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function RailButton({ onClick, label, danger, children }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'no-tap grid h-11 w-11 place-items-center rounded-2xl text-ink-3 transition',
        danger ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
