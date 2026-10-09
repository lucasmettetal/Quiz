import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/components/ui/Toaster'
import { VisibilityPicker } from '@/features/quizzes/ShareQuizDialog'
import { quizKeys } from '@/features/quizzes/useQuizActions'
import { questionIssues } from '@/features/questions/registry'
import { publishQuiz } from '@/services/quizzes'
import { useEditorStore } from '@/stores/editorStore'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'
import type { Visibility } from '@/types/database'

export function PublishDialog({ open, onClose, flush }: { open: boolean; onClose: () => void; flush: () => Promise<boolean> }) {
  const t = useT()
  const queryClient = useQueryClient()
  const quizId = useEditorStore((s) => s.quizId)
  const current = useEditorStore((s) => s.visibility)
  const status = useEditorStore((s) => s.status)
  const invalid = useEditorStore((s) => s.questions.filter((q) => questionIssues(q).length > 0).length)
  const empty = useEditorStore((s) => s.questions.length === 0)
  const hasTitle = useEditorStore((s) => s.meta.title.trim().length > 0)
  const setPublication = useEditorStore((s) => s.setPublication)
  const [visibility, setVisibility] = useState<Visibility>(status === 'published' ? current : 'public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocker = !hasTitle ? t('errors.QUIZ_TITLE_MISSING') : empty ? t('errors.QUIZ_EMPTY') : invalid ? t('editor.publishBlocked') : null

  async function publish() {
    setLoading(true)
    setError(null)
    try {
      await flush()
      const quiz = await publishQuiz(quizId, visibility)
      setPublication(quiz.status, quiz.visibility)
      void queryClient.invalidateQueries({ queryKey: quizKeys.all })
      toast({ message: t('editor.publishDone') })
      onClose()
    } catch (e) {
      setError(t(`errors.${toAppError(e).code}`))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('editor.publishTitle')}
      description={t('editor.publishLead')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={publish} loading={loading} disabled={Boolean(blocker)}>
            {t('editor.publish')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <VisibilityPicker value={visibility} onChange={setVisibility} />
        {(blocker || error) && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error ?? blocker}
          </p>
        )}
      </div>
    </Dialog>
  )
}
