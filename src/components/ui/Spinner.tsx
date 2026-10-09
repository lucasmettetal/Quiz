import { cn } from '@/lib/cn'

/** Two tilted squares chasing each other — Tilt's loader. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} aria-label={label} className={cn('inline-block size-5', className)}>
      <svg viewBox="0 0 24 24" className="size-full animate-spin [animation-duration:900ms]" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.35" />
      </svg>
    </span>
  )
}

export function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg text-primary">
      <Spinner className="size-10" label={label} />
    </div>
  )
}
