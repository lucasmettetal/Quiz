import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Button, IconButton } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/**
 * Built on the native <dialog>: focus trap, Escape and inert background come
 * from the browser; we only add the look and backdrop click.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()
  const t = useT()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-lg border-2 border-edge bg-surface p-0 text-fg shadow-block-lg',
        'backdrop:bg-ink/55 open:animate-pop-in',
        SIZES[size],
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-start gap-4 px-6 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-xl font-bold">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-fg-muted">
                  {description}
                </p>
              )}
            </div>
            <IconButton label={t('common.close')} icon={<X className="size-5" />} size="sm" onClick={onClose} />
          </header>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>}
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<unknown> | void
  title: ReactNode
  description?: ReactNode
  confirmLabel: string
  tone?: 'danger' | 'primary'
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, tone = 'danger' }: ConfirmDialogProps) {
  const t = useT()
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant={tone} onClick={handleConfirm} loading={busy} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
