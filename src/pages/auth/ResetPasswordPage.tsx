import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { passwordSchema } from '@/features/auth/authForms'
import { updatePassword } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

/** Reached from the recovery e-mail: Supabase has opened a recovery session. */
export function ResetPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!passwordSchema.safeParse(password).success) return setInvalid(true)
    setInvalid(false)
    setLoading(true)
    setError(null)
    try {
      await updatePassword(password)
      toast({ message: t('auth.passwordUpdated') })
      navigate('/app', { replace: true })
    } catch (err) {
      setError(t(`errors.${toAppError(err).code}`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('auth.resetTitle')} lead={t('auth.resetLead')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={invalid && t('auth.validation.password')}
          autoFocus
        />
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={loading}>
          {t('auth.updatePassword')}
        </Button>
      </form>
    </AuthLayout>
  )
}
