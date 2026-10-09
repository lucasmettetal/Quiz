import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { MailCheck } from 'lucide-react'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { displayNameSchema, emailSchema, passwordSchema, validateFields, type FieldErrors } from '@/features/auth/authForms'
import { GoogleButton } from '@/features/auth/GoogleButton'
import { safeNext } from '@/features/auth/RequireCreator'
import { signUp } from '@/services/auth'
import { toAppError } from '@/lib/errors'
import { useI18n } from '@/i18n/I18nProvider'

type Fields = 'name' | 'email' | 'password'

export function SignupPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [values, setValues] = useState<Record<Fields, string>>({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<Fields>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const set = (k: Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const fieldErrors = validateFields(values, { name: displayNameSchema, email: emailSchema, password: passwordSchema })
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length) return
    setLoading(true)
    setFormError(null)
    try {
      const active = await signUp({ email: values.email.trim(), password: values.password, displayName: values.name.trim(), locale })
      if (active) navigate(next, { replace: true })
      else setConfirmationSent(true)
    } catch (err) {
      setFormError(t(`errors.${toAppError(err).code}`))
    } finally {
      setLoading(false)
    }
  }

  if (confirmationSent) {
    return (
      <AuthLayout title={t('auth.signupTitle')}>
        <div className="flex items-start gap-3 rounded-md border-2 border-line bg-surface p-4">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-teal" aria-hidden="true" />
          <p role="status">{t('auth.checkInbox')}</p>
        </div>
        <Link to="/auth/login" className="mt-6 inline-block font-semibold text-primary hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.signupTitle')}
      lead={t('auth.signupLead')}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link className="font-semibold text-primary hover:underline" to={`/auth/login${params.size ? `?${params}` : ''}`}>
            {t('auth.login')}
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <TextField
          label={t('auth.name')}
          placeholder={t('auth.namePlaceholder')}
          autoComplete="name"
          maxLength={60}
          value={values.name}
          onChange={set('name')}
          error={errors.name && t('auth.validation.name')}
          autoFocus
        />
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email && t('auth.validation.email')}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          hint={t('auth.passwordHint')}
          value={values.password}
          onChange={set('password')}
          error={errors.password && t('auth.validation.password')}
        />
        {formError && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" loading={loading}>
          {t('auth.signup')}
        </Button>
      </form>
    </AuthLayout>
  )
}
