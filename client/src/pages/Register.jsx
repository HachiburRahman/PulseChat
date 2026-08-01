import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { LuAtSign, LuKeyRound, LuTriangleAlert, LuUserRound } from 'react-icons/lu'
import { useAuth } from '@/hooks/useAuth'
import { AuthLayout } from '@/components/AuthLayout'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { DemoNotice } from '@/components/DemoNotice'
import { ROUTES } from '@/utils/constants'
import { cn } from '@/utils/cn'

const RULES = [
  { test: (v) => v.length >= 8, label: '8+ characters' },
  { test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v), label: 'Upper & lower case' },
  { test: (v) => /\d/.test(v), label: 'A number' },
]

export default function Register() {
  const { register, user, demo } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={ROUTES.chat} replace />

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const passed = RULES.filter((r) => r.test(form.password)).length
  const strong = passed === RULES.length

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('What should everyone call you?')
    if (!strong && !demo) return setError('Pick a password that meets all three rules.')

    setBusy(true)
    setError(null)
    try {
      await register({ ...form, name: form.name.trim() })
      navigate(ROUTES.chat, { replace: true })
    } catch (err) {
      setError(err.friendly || 'Could not create that account.')
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="get started"
      title="Create your account"
      subtitle="One account gets you rooms, direct messages and the AI assistant."
      footer={
        <p className="text-sm text-ink-3">
          Already have one?{' '}
          <Link
            to={ROUTES.login}
            className="font-medium text-signal underline-offset-4 hover:underline"
          >
            Sign in
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
          label="Display name"
          icon={LuUserRound}
          placeholder="Hachibur Rahman"
          autoComplete="name"
          value={form.name}
          onChange={set('name')}
          maxLength={40}
          required
        />

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

        <div className="space-y-3">
          <Field
            label="Password"
            type="password"
            icon={LuKeyRound}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            required
          />

          <div className="flex gap-1.5" aria-hidden="true">
            {RULES.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  i < passed ? (strong ? 'bg-online' : 'bg-signal') : 'bg-surface-3',
                )}
              />
            ))}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {RULES.map((rule) => {
              const ok = rule.test(form.password)
              return (
                <li
                  key={rule.label}
                  className={cn(
                    'flex items-center gap-1.5 text-[0.6875rem] transition-colors',
                    ok ? 'text-online' : 'text-ink-3',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors',
                      ok ? 'bg-online' : 'bg-ink-3/40',
                    )}
                  />
                  {rule.label}
                </li>
              )
            })}
          </ul>
        </div>

        <Button type="submit" variant="signal" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>

        <p className="text-center text-[0.6875rem] leading-relaxed text-ink-3">
          Passwords are hashed with bcrypt on the server — the browser never stores yours.
        </p>
      </form>
    </AuthLayout>
  )
}
