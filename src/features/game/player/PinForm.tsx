import { useId, useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { formatPin } from '@/lib/format'
import { useT } from '@/i18n/I18nProvider'

/** Keeps digits only and formats as "123 456" while typing. */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizePin(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 6)
}

interface PinFormProps {
  onSubmit: (pin: string) => void
  defaultValue?: string
  loading?: boolean
  error?: string | null
  tone?: 'stage' | 'surface'
  autoFocus?: boolean
  submitLabel?: string
}

export function PinForm({ onSubmit, defaultValue = '', loading, error, tone = 'surface', autoFocus, submitLabel }: PinFormProps) {
  const t = useT()
  const id = useId()
  const [pin, setPin] = useState(normalizePin(defaultValue))
  const complete = pin.length === 6

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (complete) onSubmit(pin)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor={id} className="sr-only">
        {t('player.pinLabel')}
      </label>
      <input
        id={id}
        value={formatPin(pin)}
        onChange={(e) => setPin(normalizePin(e.target.value))}
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="go"
        autoFocus={autoFocus}
        placeholder={t('player.pinPlaceholder')}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          'h-16 w-full rounded-md border-2 text-center font-display text-3xl font-bold tracking-[0.18em] tabular transition-colors duration-150 focus:outline-none',
          tone === 'stage'
            ? 'border-white/20 bg-white/10 text-paper placeholder:text-paper/30 focus:border-lime'
            : 'border-line bg-surface text-fg placeholder:text-fg-subtle focus:border-cobalt dark:focus:border-lime',
          error && 'animate-wiggle border-danger',
        )}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className={cn('text-sm font-medium', tone === 'stage' ? 'text-amber' : 'text-danger')}>
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        variant={tone === 'stage' ? 'paper' : 'primary'}
        disabled={!complete}
        loading={loading}
        iconRight={<ArrowRight className="size-5" />}
      >
        {submitLabel ?? t('player.pinAction')}
      </Button>
    </form>
  )
}
