import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LuAtSign, LuKeyRound, LuTriangleAlert } from 'react-icons/lu'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from '@/components/AuthLayout'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { DemoNotice } from '@/components/DemoNotice'
import { ROUTES, DEMO_MODE } from '@/utils/constants'

const DEMO_CREDS = { email: 'demo@pulsechat.app', password: 'pulsechat' }

export default function Login() {
  const { login, user, demo } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(DEMO_MODE ? DEMO_CREDS : { email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={location.state?.from?.pathname || ROUTES.chat} replace />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(form)
      navigate(location.state?.from?.pathname || ROUTES.chat, { replace: true })
    } catch (err) {
      setError(err.friendly || 'Those credentials did not work.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="welcome back"
      title="Sign in to PulseChat"
      subtitle="Your rooms, unread badges and AI history are exactly where you left them."
      footer={
        <p className="text-sm text-ink-3">
          New here?{' '}
          <Link
            to={ROUTES.register}
            className="font-medium text-signal underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {demo && <DemoNotice />}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3"
          >
            <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="text-xs leading-relaxed text-danger">{error}</p>
          </div>
        )}

        <Field
          label="Email"
          type="email"
          icon={LuAtSign}
          placeholder="you@studio.dev"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          required
        />

        <Field
          label="Password"
          type="password"
          icon={LuKeyRound}
          placeholder="••••••••"
          autoComplete="current-password"
          value={form.password}
          onChange={set('password')}
          required
        />

        <Button type="submit" variant="signal" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
