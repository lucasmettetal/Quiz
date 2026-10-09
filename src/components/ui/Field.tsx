import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-md border-2 border-line bg-surface px-3 text-fg placeholder:text-fg-subtle ' +
  'transition-colors duration-150 hover:border-fg-subtle focus:border-cobalt focus:outline-none ' +
  'dark:focus:border-lime aria-[invalid=true]:border-danger disabled:opacity-60'

export function Input({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'h-11', className)} {...rest} />
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-24 resize-y py-2.5 leading-relaxed', className)} {...rest} />
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        CONTROL,
        'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23858197' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  )
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  className?: string
  /** Render-prop receives the ids to wire on the control. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/** Input + label + hint/error in one go. */
export function TextField({
  label,
  hint,
  error,
  className,
  ...input
}: { label: ReactNode; hint?: ReactNode; error?: ReactNode } & ComponentProps<'input'>) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...input} />
      )}
    </Field>
  )
}
