import { useEffect, useMemo, useRef, useState } from 'react'
import { encode } from 'uqr'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/I18nProvider'

/** QR code drawn as a single SVG path (no innerHTML). */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { border: 1, ecc: 'M' })
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { path: d, size: qr.size }
  }, [value])
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#faf6ee" />
      <path d={path} fill="#17142b" />
    </svg>
  )
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Counts up to `value` (ease-out), so score changes are felt, not just read. */
export function AnimatedNumber({ value, duration = 700, className }: { value: number; duration?: number; className?: string }) {
  const { locale } = useI18n()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value || prefersReducedMotion()) {
      from.current = value
      const id = requestAnimationFrame(() => setShown(value))
      return () => cancelAnimationFrame(id)
    }
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])
  return <span className={cn('tabular', className)}>{new Intl.NumberFormat(locale).format(shown)}</span>
}

/**
 * Countdown as a thick ring that empties, with the seconds in the middle.
 * Turns amber then vermilion in the last seconds.
 */
export function CountdownRing({ remainingMs, totalMs, size = 120, className }: { remainingMs: number; totalMs: number; size?: number; className?: string }) {
  const seconds = Math.ceil(remainingMs / 1000)
  const ratio = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0
  const r = 42
  const circumference = 2 * Math.PI * r
  const tone = seconds <= 3 ? 'text-vermilion' : seconds <= 5 ? 'text-amber' : 'text-lime'
  return (
    <div className={cn('relative grid place-items-center', className)} style={{ width: size, height: size }} role="timer" aria-live="off" aria-label={`${seconds} s`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="12" className="text-white/12" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn('transition-[stroke-dashoffset,color] duration-200 ease-linear', tone)}
        />
      </svg>
      <span className={cn('font-display font-black tabular', seconds <= 3 && seconds > 0 && 'animate-pulse')} style={{ fontSize: size * 0.36 }}>
        {seconds}
      </span>
    </div>
  )
}

/** Thin bar version of the countdown, for phones. */
export function CountdownBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const ratio = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0
  const seconds = Math.ceil(remainingMs / 1000)
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${seconds} s`}>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/15">
        <div
          className={cn('h-full rounded-full transition-[width,background-color] duration-200 ease-linear', seconds <= 3 ? 'bg-vermilion' : seconds <= 5 ? 'bg-amber' : 'bg-lime')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="w-8 text-right font-display text-xl font-black tabular">{seconds}</span>
    </div>
  )
}

/** Deterministic small tilt per id: lively but stable between renders. */
// eslint-disable-next-line react-refresh/only-export-components
export function tiltFor(id: string, max = 4) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % (max * 2 + 1)) - max) as number
}
