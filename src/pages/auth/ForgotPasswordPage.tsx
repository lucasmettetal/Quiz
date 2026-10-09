import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { MailCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { emailSchema } from '@/features/auth/authForms'
import { sendPasswordReset } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

export function ForgotPasswordPage() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!emailSchema.safeParse(email.trim()).success) return setInvalid(true)
    setInvalid(false)
    setLoading(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(t(`errors.${toAppError(err).code}`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.forgotTitle')}
      lead={t('auth.forgotLead')}
      footer={
        <Link className="font-semibold text-primary hover:underline" to="/auth/login">
          {t('auth.backToLogin')}
        </Link>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-md border-2 border-line bg-surface p-4" role="status">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-teal" aria-hidden="true" />
          <p>{t('auth.linkSent', { email: email.trim() })}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={invalid && t('auth.validation.email')}
            autoFocus
          />
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" loading={loading}>
            {t('auth.sendLink')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
