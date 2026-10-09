import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { updatePassword } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'
import { passwordSchema } from './authForms'

/** Password change for a signed-in creator (Settings). Recovery by e-mail lives on /auth/reset. */
export function ChangePasswordForm() {
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<'password' | 'confirm' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!passwordSchema.safeParse(password).success) return setFieldError('password')
    if (password !== confirm) return setFieldError('confirm')
    setFieldError(null)
    setError(null)
    setLoading(true)
    try {
      await updatePassword(password)
      setPassword('')
      setConfirm('')
      toast({ message: t('auth.passwordChanged') })
    } catch (err) {
      setError(t(`errors.${toAppError(err).code}`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <TextField
        label={t('auth.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldError === 'password' && t('auth.validation.password')}
      />
      <TextField
        label={t('auth.confirmPassword')}
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={fieldError === 'confirm' && t('auth.passwordsMismatch')}
      />
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" className="self-start" loading={loading}>
        {t('auth.changePasswordTitle')}
      </Button>
    </form>
  )
}
