import { Link2Off } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'
import { AUTH_ROUTES } from './redirects'

/** Explains why an e-mail link failed and offers the way out. */
export function AuthLinkProblem({ error, retryTo = AUTH_ROUTES.forgot }: { error: unknown; retryTo?: string }) {
  const t = useT()
  const { code } = toAppError(error)
  return (
    <div role="alert" className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-md border-2 border-line bg-surface p-4">
        <Link2Off className="mt-0.5 size-6 shrink-0 text-danger-ink" aria-hidden="true" />
        <div>
          <p className="font-bold">{t('auth.linkProblemTitle')}</p>
          <p className="mt-1 text-sm text-fg-muted">{t(`errors.${code}`)}</p>
        </div>
      </div>
      <ButtonLink to={retryTo} size="lg">
        {t('auth.requestNewLink')}
      </ButtonLink>
      <ButtonLink to={AUTH_ROUTES.login} variant="ghost">
        {t('auth.backToLogin')}
      </ButtonLink>
    </div>
  )
}
