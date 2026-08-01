import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LuCamera,
  LuCheck,
  LuChevronLeft,
  LuLogOut,
  LuMoon,
  LuSun,
  LuTriangleAlert,
} from 'react-icons/lu'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { useSocket } from '@/hooks/useSocket'
import { useTheme } from '@/hooks/useTheme'
import { uploadFile, firebaseReady } from '@/firebase/firebase'
import { Avatar } from '@/components/Avatar'
import { SignalBars } from '@/components/Logo'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/utils/constants'

export default function Profile() {
  const { user, updateProfile, logout, demo } = useAuth()
  const { status } = useSocket()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [uploading, setUploading] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const dirty = name.trim() !== (user?.name || '') || avatarUrl !== (user?.avatarUrl || '')

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Pick an image file.')

    setError(null)
    setUploading(1)
    try {
      const result = await uploadFile(file, { userId: user?._id, onProgress: setUploading })
      setAvatarUrl(result.url)
    } catch {
      setError('Upload failed. Check your Firebase Storage rules.')
    } finally {
      setUploading(0)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setError('Your name cannot be empty.')
    setSaving(true)
    setError(null)
    try {
      await updateProfile({ name: name.trim(), avatarUrl })
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      setError(err.friendly || 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-y-auto bg-bg">
      {/* ── banner ─────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden border-b border-line bg-bg-deep">
        <SignalBars
          count={70}
          height={80}
          speed={2.4}
          className="pointer-events-none absolute inset-x-0 bottom-0 text-signal opacity-15"
        />
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--signal)' }}
        />

        <div className="relative mx-auto w-full max-w-2xl px-5 pb-8 pt-5 sm:px-8">
          <button
            onClick={() => navigate(ROUTES.chat)}
            className="no-tap -ml-2 mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-3 transition hover:bg-surface-2 hover:text-ink lg:hidden"
          >
            <LuChevronLeft className="h-4 w-4" /> Conversations
          </button>

          <div className="flex items-end gap-5">
            <div className="relative">
              <Avatar
                user={{ ...user, avatarUrl }}
                size="xl"
                online={status === 'live'}
                showStatus
              />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={Boolean(uploading)}
                aria-label="Change avatar"
                className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-xl border border-line-strong bg-elev text-ink-2 shadow-lift transition hover:text-signal disabled:opacity-50"
              >
                <LuCamera className="h-4 w-4" />
              </button>
              {uploading > 0 && (
                <span className="absolute inset-0 grid place-items-center rounded-3xl bg-bg-deep/70 font-mono text-xs text-signal">
                  {uploading}%
                </span>
              )}
            </div>

            <div className="min-w-0 pb-1">
              <p className="label">your account</p>
              <h1 className="mt-1.5 truncate font-display text-2xl font-semibold tracking-tight">
                {user?.name}
              </h1>
              <p className="mt-1 truncate text-xs text-ink-3">{user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── body ───────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-2xl space-y-8 px-5 py-8 sm:px-8">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3">
            <LuTriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p className="text-xs leading-relaxed text-danger">{error}</p>
          </div>
        )}

        <Card title="Profile" hint="This is what everyone sees next to your messages.">
          <form onSubmit={save} className="space-y-5">
            <Field
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Your name"
            />
            <Field
              label="Email"
              value={user?.email || '—'}
              readOnly
              disabled
              hint="Email changes are not supported yet."
              inputClassName="opacity-60"
            />
            <div className="flex items-center gap-3">
              <Button type="submit" variant="signal" loading={saving} disabled={!dirty}>
                Save changes
              </Button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-xs text-online animate-fade">
                  <LuCheck className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          </form>
        </Card>

        <Card title="Appearance" hint="Applies instantly and is remembered on this device.">
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'dark', label: 'Dark', icon: LuMoon },
              { key: 'light', label: 'Light', icon: LuSun },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                  theme === key
                    ? 'border-signal/50 bg-signal-soft'
                    : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <span
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-lg',
                    theme === key ? 'bg-signal/15 text-signal' : 'bg-surface-2 text-ink-3',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-ink">{label}</span>
                {theme === key && <LuCheck className="ml-auto h-4 w-4 text-signal" />}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Connection" hint="How this tab is talking to the backend right now.">
          <dl className="divide-y divide-line text-sm">
            <Row label="Realtime socket">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  status === 'live' ? 'text-online' : status === 'down' ? 'text-danger' : 'text-ink-3',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {status === 'live' ? 'Connected' : status === 'down' ? 'Disconnected' : 'Connecting'}
              </span>
            </Row>
            <Row label="Data source">
              {demo ? 'In-memory demo fixtures' : 'Express REST API'}
            </Row>
            <Row label="Media uploads">
              {firebaseReady ? 'Firebase Storage' : 'Local preview (Firebase not configured)'}
            </Row>
          </dl>
        </Card>

        <div className="pb-10">
          <Button
            variant="danger"
            onClick={() => {
              logout()
              navigate(ROUTES.login, { replace: true })
            }}
          >
            <LuLogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}

function Card({ title, hint, children }) {
  return (
    <section className="rounded-2xl border border-line bg-elev p-5 sm:p-6">
      <header className="mb-5">
        <h2 className="text-base">{title}</h2>
        {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      </header>
      {children}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  )
}
