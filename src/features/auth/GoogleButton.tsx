import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { env } from '@/lib/env'
import { signInWithGoogle } from '@/services/auth'
import { useT } from '@/i18n/I18nProvider'

/** Only rendered when Google OAuth is enabled (VITE_ENABLE_GOOGLE_AUTH=true): no dead buttons. */
export function GoogleButton({ next }: { next: string }) {
  const t = useT()
  const [loading, setLoading] = useState(false)
  if (!env.googleAuthEnabled) return null
  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        loading={loading}
        onClick={async () => {
          setLoading(true)
          try {
            await signInWithGoogle(next)
          } catch {
            setLoading(false)
          }
        }}
        icon={
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
        }
      >
        {t('auth.google')}
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold tracking-widest text-fg-subtle uppercase">
        <span className="h-0.5 flex-1 bg-line" />
        {t('auth.or')}
        <span className="h-0.5 flex-1 bg-line" />
      </div>
    </>
  )
}
