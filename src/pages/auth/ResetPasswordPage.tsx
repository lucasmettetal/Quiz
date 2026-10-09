import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/Toaster'
import { AuthLinkProblem } from '@/features/auth/AuthLinkProblem'
import { passwordSchema } from '@/features/auth/authForms'
import { clearRecovery, hasRecovery, markRecovery } from '@/features/auth/redirects'
import { completeAuthRedirect, updatePassword } from '@/services/auth'
import { AppError, toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

/**
 * Landing page of the recovery e-mail. The new-password form is only offered
 * when this tab holds a recovery session (opened from the link); anything else
 * — expired link, other browser, no link at all — gets an explanation and a
 * way to ask for a new link.
 */
async function checkRecovery(): Promise<{ userId: string }> {
  const { fromLink, session } = await completeAuthRedirect()
  if (!session) throw new AppError('LINK_INVALID')
  if (fromLink) markRecovery(session.user.id)
  else if (!hasRecovery(session.user.id)) throw new AppError('LINK_INVALID')
  return { userId: session.user.id }
}

export function ResetPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  // A query (not an effect) so the code is exchanged once, even under StrictMode.
  const recovery = useQuery({ queryKey: ['auth', 'recovery'], queryFn: checkRecovery, retry: false, staleTime: Infinity, gcTime: 0 })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<'password' | 'confirm' | null>(null)
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!passwordSchema.safeParse(password).success) return setFieldError('password')
    if (password !== confirm) return setFieldError('confirm')
    setFieldError(null)
    setLoading(true)
    setError(null)
    try {
      await updatePassword(password)
      clearRecovery()
      toast({ message: t('auth.passwordUpdated') })
      navigate('/app', { replace: true })
    } catch (err) {
      setError(toAppError(err))
    } finally {
      setLoading(false)
    }
  }

  // The recovery session itself is gone (expired / used): same remedy as a bad link.
  const linkError = recovery.error ?? (error && error.code === 'LINK_INVALID' ? error : null)

  return (
    <AuthLayout title={t('auth.resetTitle')} lead={recovery.isSuccess && !linkError ? t('auth.resetLead') : undefined}>
      {recovery.isPending ? (
        <div className="flex items-center gap-3 text-fg-muted" role="status">
          <Spinner className="size-5 text-primary-ink" /> {t('auth.checkingLink')}
        </div>
      ) : linkError ? (
        <AuthLinkProblem error={linkError} />
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <TextField
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            hint={t('auth.passwordHint')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldError === 'password' && t('auth.validation.password')}
            autoFocus
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
              {t(`errors.${error.code}`)}
            </p>
          )}
          <Button type="submit" size="lg" loading={loading}>
            {t('auth.updatePassword')}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
