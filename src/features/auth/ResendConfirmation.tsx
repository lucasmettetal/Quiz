import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { resendSignupConfirmation } from '@/services/auth'
import { toAppError, type AppError } from '@/lib/errors'
import { applyRateLimit, authErrorMessage, useEmailCooldown } from './rateLimit'
import { useT } from '@/i18n/I18nProvider'

/** Asks Supabase to send the confirmation e-mail again (through its SMTP). */
export function ResendConfirmation({ email }: { email: string }) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<AppError | null>(null)
  const cooldown = useEmailCooldown()
  const errorText = authErrorMessage(t, error, cooldown.secondsLeft)

  async function resend() {
    setState('sending')
    setError(null)
    try {
      await resendSignupConfirmation(email)
      setState('sent')
    } catch (e) {
      const appError = toAppError(e)
      applyRateLimit(appError, cooldown.start)
      setError(appError)
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
        <Button variant="secondary" onClick={resend} loading={state === 'sending'} disabled={!email || cooldown.secondsLeft > 0}>
          {cooldown.secondsLeft > 0 ? t('auth.retryIn', { seconds: cooldown.secondsLeft }) : t('auth.resendConfirmation')}
        </Button>
      )}
      {errorText && (
        <p role="alert" className="text-sm font-medium text-danger-ink">
          {errorText}
        </p>
      )}
    </div>
  )
}
