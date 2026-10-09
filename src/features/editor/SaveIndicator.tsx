import { AlertTriangle, Check, CloudOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useEditorStore } from '@/stores/editorStore'
import { useT } from '@/i18n/I18nProvider'

/** Always-visible save state: the user never wonders whether their work is safe. */
export function SaveIndicator() {
  const t = useT()
  const status = useEditorStore((s) => s.saveStatus)
  const map = {
    idle: { icon: Check, label: t('editor.saved'), tone: 'text-fg-subtle' },
    saved: { icon: Check, label: t('editor.saved'), tone: 'text-success' },
    pending: { icon: Loader2, label: t('editor.unsaved'), tone: 'text-fg-subtle' },
    saving: { icon: Loader2, label: t('editor.saving'), tone: 'text-fg-muted' },
    offline: { icon: CloudOff, label: t('editor.offline'), tone: 'text-amber-deep' },
    error: { icon: AlertTriangle, label: t('editor.saveError'), tone: 'text-danger' },
    conflict: { icon: AlertTriangle, label: t('errors.VERSION_CONFLICT'), tone: 'text-danger' },
  }[status]
  const Icon = map.icon
  const spinning = status === 'saving' || status === 'pending'
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap', map.tone)}>
      <Icon className={cn('size-4', spinning && status === 'saving' && 'animate-spin')} aria-hidden="true" />
      <span className="hidden sm:inline">{map.label}</span>
    </span>
  )
}
