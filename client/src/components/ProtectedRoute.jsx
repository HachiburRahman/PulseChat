import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from './Logo'
import { ROUTES } from '@/utils/constants'

export function ProtectedRoute({ children }) {
  const { user, booting } = useAuth()
  const location = useLocation()

  if (booting) return <BootScreen />
  if (!user) return <Navigate to={ROUTES.login} state={{ from: location }} replace />
  return children
}

export function BootScreen() {
  return (
    <div className="grain field flex h-full flex-col items-center justify-center gap-5 bg-bg">
      <Logo size={54} />
      <p className="label animate-shimmer">Restoring your session</p>
    </div>
  )
}
