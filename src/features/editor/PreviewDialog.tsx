import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { calculateQuestionScore } from '@/features/game/engine/scoring'
import { evaluateAnswer, questionTypes } from '@/features/questions/registry'
import { solutionOf, toPublicQuestion } from '@/features/questions/public'
import { PlayerAnswerInput } from '@/features/questions/ui/PlayerInputs'
import type { AnyAnswer, QuestionOf, QuestionType } from '@/features/questions/model'
import { useEditorStore } from '@/stores/editorStore'
import { mediaPublicUrl } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

/** Lets the author try the selected question exactly as a player would. */
export function PreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const question = useEditorStore((s) => s.questions.find((q) => q.id === s.selectedId) ?? null)
  const [answer, setAnswer] = useState<AnyAnswer | null>(null)
  if (!question) return null

  const publicQuestion = toPublicQuestion(question)
  const result = answer ? evaluateAnswer(question as QuestionOf<QuestionType>, answer as never) : undefined
  const graded = questionTypes[question.type].graded
  const halfTimeScore = calculateQuestionScore({
    points: question.points,
    timeLimitMs: question.time_limit_s * 1000,
    elapsedMs: (question.time_limit_s * 1000) / 2,
    isCorrect: true,
  })
  const image = mediaPublicUrl(question.media?.path)

  return (
    <Dialog
      open={open}
      onClose={() => {
        setAnswer(null)
        onClose()
      }}
      title={t('editor.preview.title')}
      description={t('editor.preview.lead')}
      size="md"
    >
      {/* Phone frame */}
      <div className="mx-auto w-full max-w-[380px] rounded-[28px] border-[3px] border-edge bg-stage p-4 pb-5 text-stage-fg shadow-block">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/20" aria-hidden="true" />
        <p className="mb-3 text-center font-display text-xl leading-tight font-bold">{question.prompt || t('editor.promptPlaceholder')}</p>
        {image && <img src={image} alt={question.media?.alt ?? ''} className="mx-auto mb-3 max-h-32 rounded-sm object-contain" />}
        <PlayerAnswerInput
          key={`${question.id}-${question.type}-${answer ? 1 : 0}`}
          question={publicQuestion}
          submitted={answer}
          onSubmit={setAnswer}
          solution={answer ? solutionOf(question) : null}
        />
        {answer && (
          <div
            role="status"
            className={cn(
              'mt-4 animate-pop-in rounded-md border-[3px] border-black px-4 py-3 text-center font-display text-2xl font-extrabold',
              result === null ? 'bg-amber text-ink' : result ? 'bg-success text-white' : 'bg-danger text-white',
            )}
          >
            {result === null ? t('editor.preview.pollRecorded') : result ? t('editor.preview.correct') : t('editor.preview.wrong')}
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-fg-muted">{graded && question.points > 0 ? t('editor.preview.scoreHint', { points: halfTimeScore }) : ''}</p>
        {answer && (
          <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => setAnswer(null)}>
            {t('editor.preview.reset')}
          </Button>
        )}
      </div>
    </Dialog>
  )
}
