import { useState } from 'react'
import { Globe, Link2, Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { CopyButton } from '@/components/ui/misc'
import { publishQuiz } from '@/services/quizzes'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import type { Quiz, Visibility } from '@/types/database'
import { quizKeys } from './useQuizActions'

const OPTIONS: Array<{ value: Visibility; icon: typeof Globe }> = [
  { value: 'private', icon: Lock },
  { value: 'unlisted', icon: Link2 },
  { value: 'public', icon: Globe },
]

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  const t = useT()
  const hints: Record<Visibility, string> = {
    private: t('editor.publishPrivateHint'),
    unlisted: t('editor.publishUnlistedHint'),
    public: t('editor.publishPublicHint'),
  }
  return (
    <div role="radiogroup" aria-label={t('editor.publishTitle')} className="flex flex-col gap-2">
      {OPTIONS.map(({ value: v, icon: Icon }) => {
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-start gap-3 rounded-md border-2 p-3 text-left transition-colors duration-150',
              active ? 'border-edge bg-primary-soft' : 'border-line hover:border-fg-subtle',
            )}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', active ? 'text-primary' : 'text-fg-subtle')} aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold">{t(`quizzes.visibility.${v}`)}</span>
              <span className="block text-xs text-fg-muted">{hints[v]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function ShareQuizDialog({ quiz, open, onClose }: { quiz: Quiz; open: boolean; onClose: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [visibility, setVisibility] = useState<Visibility>(quiz.visibility === 'private' ? 'unlisted' : quiz.visibility)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shareable = quiz.status === 'published' && quiz.visibility !== 'private'
  const url = `${window.location.origin}/quiz/${quiz.id}`

  async function publish() {
    setSaving(true)
    setError(null)
    try {
      await publishQuiz(quiz.id, visibility)
      await queryClient.invalidateQueries({ queryKey: quizKeys.all })
    } catch (e) {
      setError(t(`errors.${toAppError(e).code}`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('quizzes.shareTitle')} description={shareable ? t('quizzes.shareText') : t('quizzes.sharePrivate')}>
      {shareable ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={url} aria-label={t('quizzes.shareLink')} onFocus={(e) => e.currentTarget.select()} />
          <CopyButton value={url} label={t('common.copy')} variant="primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <Button onClick={publish} loading={saving} disabled={visibility === 'private'} className="self-end">
            {t('editor.publish')}
          </Button>
        </div>
      )}
    </Dialog>
  )
}
