import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES, answerSlot } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'
import type { Question } from '../model'
import { QUESTION_TYPE_META } from './typeMeta'

/** Read-only rendering of a question (quiz detail page, reports). */
export function QuestionSummary({ question, index, showAnswers }: { question: Question; index: number; showAnswers: boolean }) {
  const t = useT()
  const meta = QUESTION_TYPE_META[question.type]
  const Icon = meta.icon
  return (
    <li className="rounded-md border-2 border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className={cn('grid size-8 shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-edge font-display text-sm font-bold', COLOR_CLASSES[meta.color].bg, COLOR_CLASSES[meta.color].on)}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-fg-subtle">
            <Icon className="size-3.5" aria-hidden="true" /> {t(`questionTypes.${question.type}.name`)} · {t('common.seconds', { count: question.time_limit_s })}
          </p>
          <p className="mt-0.5 font-semibold">{question.prompt}</p>
          {showAnswers && <AnswersPreview question={question} />}
        </div>
      </div>
    </li>
  )
}

function AnswersPreview({ question }: { question: Question }) {
  const t = useT()
  switch (question.type) {
    case 'quiz':
    case 'poll':
      return (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {question.content.options.map((o, i) => {
            const correct = question.type === 'quiz' && 'correct' in o && o.correct
            return (
              <li key={o.id} className={cn('flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm', correct ? 'bg-success-soft font-semibold' : 'bg-surface-2')}>
                <span className="font-display font-bold text-fg-subtle">{answerSlot(i).letter}</span>
                <span className="flex-1">{o.text}</span>
                {correct && <Check className="size-4 text-success" aria-label={t('host.correctAnswer')} />}
              </li>
            )
          })}
        </ul>
      )
    case 'true_false':
      return (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-sm bg-success-soft px-2 py-1 text-sm font-semibold">
          <Check className="size-4 text-success" aria-hidden="true" />
          {question.content.correct ? t('questionTypes.trueFalse.true') : t('questionTypes.trueFalse.false')}
        </p>
      )
    case 'text':
      return (
        <p className="mt-3 text-sm">
          <span className="text-fg-muted">{t('host.acceptedAnswers')} : </span>
          <span className="font-semibold">{question.content.accepted.filter(Boolean).join(' · ')}</span>
        </p>
      )
  }
}
