import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { resendSignupConfirmation } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

/** Asks Supabase to send the confirmation e-mail again (through its SMTP). */
export function ResendConfirmation({ email }: { email: string }) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setState('sending')
    setError(null)
    try {
      await resendSignupConfirmation(email)
      setState('sent')
    } catch (e) {
      setError(t(`errors.${toAppError(e).code}`))
      setState('idle')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {state === 'sent' ? (
        <p role="status" className="text-sm font-semibold text-success-ink">
          {t('auth.confirmationResent')}
        </p>
      ) : (
        <Button variant="secondary" onClick={resend} loading={state === 'sending'} disabled={!email}>
          {t('auth.resendConfirmation')}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
