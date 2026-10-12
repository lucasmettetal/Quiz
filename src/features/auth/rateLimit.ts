import { useEffect, useState } from 'react'
import type { AppError } from '@/lib/errors'
import type { TFunction } from '@/i18n/translate'

/**
 * Countdown for "wait N seconds before asking for another e-mail".
 * `start(seconds)` begins it; `secondsLeft` drops to 0 by itself.
 */
export function useEmailCooldown() {
  const [until, setUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (until === null) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= until) setUntil(null)
    }, 250)
    return () => window.clearInterval(id)
  }, [until])

  const secondsLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))

  function start(seconds: number) {
    const t = Date.now()
    setNow(t)
    setUntil(t + seconds * 1000)
  }

  return { secondsLeft, start }
}

/** Starts the cooldown when Supabase told us how long to wait. */
export function applyRateLimit(error: AppError, start: (seconds: number) => void) {
  const seconds = error.rateLimit?.retryAfterSeconds
  if (error.code === 'RATE_LIMITED' && seconds) start(seconds)
}

/**
 * Human message for an auth error, telling apart the two Supabase limits:
 * per address (with a live countdown) and the project's hourly e-mail cap.
 * Returns null once a per-address wait is over (the user can simply retry).
 */
export function authErrorMessage(t: TFunction, error: AppError | null, secondsLeft: number): string | null {
  if (!error) return null
  if (error.code !== 'RATE_LIMITED') return t(`errors.${error.code}`)
  const info = error.rateLimit
  if (info?.scope === 'user' && info.retryAfterSeconds) {
    return secondsLeft > 0 ? t('auth.rateLimitUser', { seconds: secondsLeft }) : null
  }
  if (info?.scope === 'project') return t('auth.rateLimitProject')
  return t('errors.RATE_LIMITED')
}
