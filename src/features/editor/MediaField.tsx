import { useRef, useState, type DragEvent } from 'react'
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/AuthProvider'
import { uploadQuizImage } from '@/services/storage'
import { toAppError } from '@/lib/errors'
import { mediaPublicUrl } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import type { QuestionMedia } from '@/features/questions/model'

interface MediaFieldProps {
  value: QuestionMedia | null
  onChange: (media: QuestionMedia | null) => void
  compact?: boolean
  label?: string
}

export function MediaField({ value, onChange, compact, label }: MediaFieldProps) {
  const t = useT()
  const { profile } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const url = mediaPublicUrl(value?.path)

  async function handleFile(file: File | undefined) {
    if (!file || !profile) return
    setUploading(true)
    setError(null)
    try {
      const path = await uploadQuizImage(file, profile.id)
      onChange({ path, alt: value?.alt ?? '' })
    } catch (e) {
      setError(t(`errors.${toAppError(e).code}`))
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files[0])
  }

  const fileInput = (
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} onChange={(e) => {
      void handleFile(e.target.files?.[0])
      e.target.value = ''
    }} />
  )

  if (value && url) {
    return (
      <div className="flex flex-col gap-2">
        <div className="group relative mx-auto w-full max-w-xl overflow-hidden rounded-md border-2 border-edge bg-surface-2">
          <img src={url} alt={value.alt} className={cn('mx-auto w-full object-contain', compact ? 'max-h-32' : 'max-h-72')} />
          <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Button size="sm" variant="paper" icon={<RefreshCw className="size-4" />} onClick={() => input.current?.click()} loading={uploading}>
              {t('editor.mediaReplace')}
            </Button>
            <Button size="sm" variant="paper" icon={<Trash2 className="size-4" />} aria-label={t('editor.mediaRemove')} onClick={() => onChange(null)} />
          </div>
        </div>
        {!compact && (
          <input
            value={value.alt}
            onChange={(e) => onChange({ ...value, alt: e.target.value.slice(0, 200) })}
            placeholder={t('editor.mediaAlt')}
            aria-label={t('editor.mediaAlt')}
            className="mx-auto w-full max-w-xl rounded-sm border-0 bg-transparent px-1 text-center text-xs text-fg-muted placeholder:text-fg-subtle focus:bg-surface focus:outline-none"
          />
        )}
        {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
        {fileInput}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={uploading}
        className={cn(
          'mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 text-center transition-colors duration-150',
          compact ? 'py-4' : 'py-8',
          dragOver ? 'border-cobalt bg-cobalt/5' : 'border-line hover:border-fg-subtle hover:bg-surface/60',
        )}
      >
        {uploading ? <Spinner className="size-6 text-primary" /> : <ImagePlus className="size-6 text-fg-subtle" aria-hidden="true" />}
        <span className="text-sm font-semibold">{uploading ? t('editor.mediaUploading') : (label ?? t('editor.mediaAdd'))}</span>
        {!compact && <span className="text-xs text-fg-subtle">{t('editor.mediaHint')}</span>}
      </button>
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      {fileInput}
    </div>
  )
}
