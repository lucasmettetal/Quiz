import type { ReactNode } from 'react'
import { RotateCcw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import type { PaletteColor, PatternName } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'
import { Button } from './Button'
import { PatternBlock } from './misc'

/** Empty states get a composed illustration of tilted blocks, never a lone icon. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  color = 'amber',
  pattern = 'dots',
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  color?: PaletteColor
  pattern?: PatternName
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="relative mb-6 h-24 w-28" aria-hidden="true">
        <PatternBlock color={color} pattern={pattern} className="absolute top-2 left-2 size-20 -rotate-6 rounded-md border-2 border-edge" />
        <div className="absolute top-0 right-0 grid size-14 rotate-6 place-items-center rounded-md border-2 border-edge bg-surface text-fg shadow-block-sm [&>svg]:size-7">
          {icon}
        </div>
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  title,
  onRetry,
  className,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  className?: string
}) {
  const t = useT()
  const appError = toAppError(error)
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-5 grid size-16 rotate-3 place-items-center rounded-md border-2 border-edge bg-danger-soft text-danger">
        {appError.code === 'NETWORK' ? <WifiOff className="size-7" /> : <span className="font-display text-3xl font-black">!</span>}
      </div>
      <h2 className="text-xl font-bold">{title ?? t('errors.title')}</h2>
      <p className="mt-2 max-w-md text-sm text-fg-muted">{t(`errors.${appError.code}`)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry} icon={<RotateCcw className="size-4" />}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
