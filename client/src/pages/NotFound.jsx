import { Link } from 'react-router-dom'
import { Logo, SignalBars } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/utils/constants'

export default function NotFound() {
  return (
    <div className="grain field relative flex h-full flex-col items-center justify-center overflow-hidden bg-bg px-6 text-center">
      <SignalBars
        count={60}
        height={140}
        speed={2.6}
        className="pointer-events-none absolute inset-x-0 bottom-0 text-signal opacity-[0.06]"
      />

      <div className="relative">
        <Logo size={52} className="mx-auto" />

        <p className="label mt-8">error 404 · signal lost</p>
        <h1 className="mt-4 font-display text-[clamp(3rem,10vw,5rem)] font-semibold leading-none tracking-[-0.04em]">
          Nothing
          <br />
          <span className="text-signal">on this</span> channel
        </h1>
        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-ink-3">
          That route does not exist. The conversation you want is probably one click away.
        </p>

        <Button as={Link} to={ROUTES.chat} variant="signal" size="lg" className="mt-8">
          Back to PulseChat
        </Button>
      </div>
    </div>
  )
}
