import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { emailSchema, validateFields, type FieldErrors } from '@/features/auth/authForms'
import { GoogleButton } from '@/features/auth/GoogleButton'
import { safeNext } from '@/features/auth/RequireCreator'
import { signInWithPassword } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'
import { z } from 'zod'

export function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const fieldErrors = validateFields(values, { email: emailSchema, password: z.string().min(1) })
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length) return
    setLoading(true)
    setFormError(null)
    try {
      await signInWithPassword(values.email.trim(), values.password)
      navigate(next, { replace: true })
    } catch (err) {
      setFormError(t(`errors.${toAppError(err).code}`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      lead={t('auth.loginLead')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link className="font-semibold text-primary hover:underline" to={`/auth/signup${params.size ? `?${params}` : ''}`}>
            {t('auth.signup')}
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={errors.email && t('auth.validation.email')}
          autoFocus
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors.password && t('auth.validation.password')}
        />
        <Link to="/auth/forgot" className="-mt-1 self-end text-sm font-semibold text-fg-muted hover:text-fg">
          {t('auth.forgotLink')}
        </Link>
        {formError && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" loading={loading}>
          {t('auth.login')}
        </Button>
      </form>
    </AuthLayout>
  )
}
