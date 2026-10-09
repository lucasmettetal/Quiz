import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/AuthProvider'
import { safeNext } from '@/features/auth/RequireCreator'
import { useT } from '@/i18n/I18nProvider'

/** OAuth / e-mail confirmation landing: supabase-js exchanges the code, then we move on. */
export function AuthCallbackPage() {
  const t = useT()
  const [params] = useSearchParams()
  const { initializing, userId } = useAuth()

  useEffect(() => {
    // If nothing happens (expired link), fall back to the login page.
    const timer = window.setTimeout(() => window.location.replace('/auth/login'), 10_000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!initializing && userId) return <Navigate to={safeNext(params.get('next'))} replace />
  return <FullPageSpinner label={t('auth.callback')} />
}
