import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { AppError } from '@/lib/errors'
import { isSupabaseConfigured } from '@/lib/env'
import { useT } from '@/i18n/I18nProvider'
import { useAuth } from './AuthProvider'

/** Gate for creator-only areas: a registered (non-anonymous) account is required. */
export function RequireCreator({ children }: { children: ReactNode }) {
  const { initializing, userId, isAnonymous, profile, profileLoading } = useAuth()
  const location = useLocation()
  const t = useT()

  if (!isSupabaseConfigured) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={new AppError('CONFIG_MISSING')} />
      </div>
    )
  }
  if (initializing || profileLoading) return <FullPageSpinner label={t('common.loading')} />
  if (!userId || isAnonymous) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth/login?next=${next}`} replace />
  }
  if (!profile) {
    // Signed in but the profile could not be read (network, or trigger missing).
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={new AppError('NETWORK')} onRetry={() => window.location.reload()} />
      </div>
    )
  }
  return children
}

/** Redirects signed-in creators away from auth pages. */
export function RedirectIfCreator({ children }: { children: ReactNode }) {
  const { initializing, userId, isAnonymous } = useAuth()
  const params = new URLSearchParams(useLocation().search)
  if (initializing) return null
  if (userId && !isAnonymous) return <Navigate to={safeNext(params.get('next'))} replace />
  return children
}

/** Only allow internal redirects (prevents open-redirect through ?next=). */
// eslint-disable-next-line react-refresh/only-export-components
export function safeNext(next: string | null, fallback = '/app') {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}
