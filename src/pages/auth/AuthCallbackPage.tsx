import { useQuery } from '@tanstack/react-query'
import { MailCheck } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { ButtonLink } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AuthLinkProblem } from '@/features/auth/AuthLinkProblem'
import { AUTH_ROUTES } from '@/features/auth/redirects'
import { safeNext } from '@/features/auth/RequireCreator'
import { completeAuthRedirect } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

/**
 * Return point of the sign-up confirmation e-mail and of OAuth. Exchanges the
 * code, then continues to `next`. Errors are explained instead of silently
 * bouncing to the login page.
 */
export function AuthCallbackPage() {
  const t = useT()
  const [params] = useSearchParams()
  const isSignup = params.get('flow') === 'signup'
  const result = useQuery({ queryKey: ['auth', 'callback'], queryFn: () => completeAuthRedirect(), retry: false, staleTime: Infinity, gcTime: 0 })

  if (result.isPending) {
    return (
      <AuthLayout title={t('auth.callback')}>
        <div className="flex items-center gap-3 text-fg-muted" role="status">
          <Spinner className="size-5 text-primary-ink" /> {t('auth.checkingLink')}
        </div>
      </AuthLayout>
    )
  }

  if (result.isSuccess && result.data.session) return <Navigate to={safeNext(params.get('next'))} replace />

  // Confirmation link opened in another browser: Supabase has already confirmed
  // the address before redirecting — only the automatic sign-in failed.
  if (isSignup && result.isError && toAppError(result.error).code === 'LINK_OTHER_DEVICE') {
    return (
      <AuthLayout title={t('auth.confirmedTitle')}>
        <div className="flex items-start gap-3 rounded-md border-2 border-line bg-surface p-4" role="status">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-teal" aria-hidden="true" />
          <p>{t('auth.confirmedOtherDevice')}</p>
        </div>
        <ButtonLink to={AUTH_ROUTES.login} size="lg" className="mt-6 w-full">
          {t('auth.login')}
        </ButtonLink>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('auth.linkProblemTitle')}>
      {/* A new confirmation e-mail can be requested from the login page. */}
      <AuthLinkProblem error={result.error ?? toAppError(new Error('LINK_INVALID'))} retryTo={AUTH_ROUTES.login} />
    </AuthLayout>
  )
}
