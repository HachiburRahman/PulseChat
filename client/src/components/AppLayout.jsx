import { Outlet } from 'react-router-dom'
import { useChat } from '@/hooks/useChat'
import { NavRail } from './NavRail'
import { Toast } from './ui/Toast'

/** The shell every signed-in route sits inside. */
export function AppLayout() {
  const { socketError, clearSocketError } = useChat()

  return (
    <div className="grain flex h-full min-h-0 overflow-hidden bg-bg">
      <NavRail />
      <main className="flex min-w-0 flex-1">
        <Outlet />
      </main>
      <Toast message={socketError} onClose={clearSocketError} />
    </div>
  )
}
