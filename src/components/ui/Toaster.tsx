import { useEffect } from 'react'
import { create } from 'zustand'
import { CheckCircle2, X } from 'lucide-react'
import { useT } from '@/i18n/I18nProvider'

/**
 * Toasts are reserved for confirmations that need an action (undo) or that
 * happen away from the user's focus. Everything else is inline feedback.
 */
interface Toast {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
  tone: 'default' | 'error'
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => void
  dismiss: (id: number) => void
}

let nextId = 1

// eslint-disable-next-line react-refresh/only-export-components
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => set((s) => ({ toasts: [...s.toasts.slice(-2), { tone: 'default', ...toast, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// eslint-disable-next-line react-refresh/only-export-components
export const toast = (t: Parameters<ToastState['push']>[0]) => useToasts.getState().push(t)

function ToastItem({ toast: item }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  const t = useT()
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), item.action ? 6000 : 3500)
    return () => window.clearTimeout(timer)
  }, [item, dismiss])

  return (
    <div className="flex animate-fade-up items-center gap-3 rounded-md border-2 border-edge bg-ink px-4 py-3 text-sm text-paper shadow-block dark:bg-surface-3">
      {item.tone === 'default' && <CheckCircle2 className="size-4 shrink-0 text-lime" aria-hidden="true" />}
      <span className="flex-1">{item.message}</span>
      {item.action && (
        <button
          type="button"
          className="rounded-sm px-2 py-1 font-bold text-lime hover:bg-white/10"
          onClick={() => {
            item.action!.onClick()
            dismiss(item.id)
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" aria-label={t('common.close')} className="rounded-sm p-1 opacity-70 hover:opacity-100" onClick={() => dismiss(item.id)}>
        <X className="size-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full max-w-md">
          <ToastItem toast={item} />
        </div>
      ))}
    </div>
  )
}
