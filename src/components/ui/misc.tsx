import { useState, type ComponentProps, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES, PATTERN_CLASSES, type PaletteColor, type PatternName } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'
import { Button, type ButtonSize, type ButtonVariant } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md', className)} />
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'ink'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-fg-muted',
    primary: 'bg-primary-soft text-primary-ink',
    success: 'bg-success-soft text-success-ink',
    danger: 'bg-danger-soft text-danger-ink',
    ink: 'bg-ink text-paper dark:bg-paper dark:text-ink',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

/** A colored, slightly tilted square with an initial: Tilt's avatar. */
export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string
  color: PaletteColor
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-lg', xl: 'size-16 text-2xl' }
  const c = COLOR_CLASSES[color]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 -rotate-3 place-items-center rounded-sm border-2 border-edge font-display font-bold uppercase',
        c.bg,
        c.on,
        sizes[size],
        className,
      )}
    >
      {name.trim().charAt(0) || '?'}
    </span>
  )
}

/** Solid color block with a pattern overlay — covers, answer tiles, decorations. */
export function PatternBlock({
  color,
  pattern,
  className,
  intensity = 'normal',
  children,
}: {
  color: PaletteColor
  pattern: PatternName
  className?: string
  intensity?: 'subtle' | 'normal'
  children?: ReactNode
}) {
  const c = COLOR_CLASSES[color]
  return (
    <div className={cn('relative isolate overflow-hidden', c.bg, c.on, className)}>
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10',
          PATTERN_CLASSES[pattern],
          c.patternInk,
          intensity === 'subtle' ? 'opacity-25' : 'opacity-45',
        )}
      />
      {children}
    </div>
  )
}

interface SegmentedProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
  hideLabels?: boolean
}

/** Radio group styled as a segmented control. */
export function SegmentedControl<T extends string>({ label, value, options, onChange, className, size = 'md', hideLabels }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-md border-2 border-line bg-surface-2 p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={hideLabels ? o.label : undefined}
            title={hideLabels ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm font-semibold transition-colors duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active ? 'bg-surface text-fg shadow-[0_1px_0_0_var(--tilt-line)]' : 'text-fg-muted hover:text-fg',
            )}
          >
            {o.icon}
            {!hideLabels && o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  id?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        {description && <span className="text-xs text-fg-muted">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors duration-150',
          checked ? 'border-edge bg-teal' : 'border-line bg-surface-3',
        )}
      >
        <span
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow transition-transform duration-150 ease-[var(--ease-snap)]',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  )
}

export function CopyButton({
  value,
  label,
  variant = 'secondary',
  size = 'md',
  className,
}: {
  value: string
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard refused: the value stays visible for manual copy */
    }
  }
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={copy}
      icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      aria-live="polite"
    >
      {copied ? t('common.copied') : label}
    </Button>
  )
}

export function VisuallyHidden(props: ComponentProps<'span'>) {
  return <span className="sr-only" {...props} />
}
