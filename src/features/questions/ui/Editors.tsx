import { Check, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES, PATTERN_CLASSES, answerSlot } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'
import { Button, IconButton } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { MAX_OPTIONS, MIN_OPTIONS } from '../definitions'
import { newOptionId, type ContentMap, type Question, type QuestionOf, type QuestionType } from '../model'

export interface ContentEditorProps<T extends QuestionType> {
  question: QuestionOf<T>
  onChange: (content: ContentMap[T]) => void
}

interface OptionRowProps {
  index: number
  text: string
  onText: (text: string) => void
  correct?: boolean
  onToggleCorrect?: () => void
  onRemove?: () => void
}

function OptionRow({ index, text, onText, correct, onToggleCorrect, onRemove }: OptionRowProps) {
  const t = useT()
  const slot = answerSlot(index)
  const c = COLOR_CLASSES[slot.color]
  const letter = slot.letter
  return (
    <div
      className={cn(
        'group relative isolate flex min-h-16 items-center gap-2 overflow-hidden rounded-md border-[3px] border-edge py-2 pr-2 pl-3 transition-shadow duration-150',
        c.bg,
        c.on,
        correct ? 'shadow-block' : 'shadow-none',
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-0 -z-10 opacity-25', PATTERN_CLASSES[slot.pattern], c.patternInk)} />
      <span aria-hidden="true" className="grid size-8 shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-paper font-display font-black text-ink">
        {letter}
      </span>
      <input
        value={text}
        onChange={(e) => onText(e.target.value)}
        maxLength={120}
        aria-label={t('questionTypes.quizEditor.option', { letter })}
        placeholder={t('questionTypes.quizEditor.optionPlaceholder')}
        className="min-w-0 flex-1 rounded-sm bg-transparent px-1 py-1.5 font-display text-lg font-bold placeholder:text-current placeholder:opacity-55 focus:bg-black/10 focus:outline-none"
      />
      {onToggleCorrect && (
        <button
          type="button"
          role="checkbox"
          aria-checked={correct}
          aria-label={t('questionTypes.quizEditor.markCorrect', { letter })}
          onClick={onToggleCorrect}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full border-[3px] border-edge transition-[transform,background-color] duration-150 ease-[var(--ease-snap)]',
            correct ? 'scale-110 bg-success text-white' : 'bg-paper/80 text-transparent hover:text-ink/40',
          )}
        >
          <Check className="size-5" strokeWidth={3.5} />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('questionTypes.quizEditor.removeOption', { letter })}
          className="grid size-8 shrink-0 place-items-center rounded-sm opacity-70 transition-opacity hover:bg-black/15 hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-70 sm:group-focus-within:opacity-70"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

function AddOptionButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 items-center justify-center gap-2 rounded-md border-[3px] border-dashed border-line font-semibold text-fg-muted transition-colors duration-150 hover:border-fg-subtle hover:text-fg"
    >
      <Plus className="size-5" /> {t('questionTypes.quizEditor.addOption')}
    </button>
  )
}

export function QuizEditor({ question, onChange }: ContentEditorProps<'quiz'>) {
  const t = useT()
  const options = question.content.options
  const set = (next: typeof options) => onChange({ options: next })
  const correctCount = options.filter((o) => o.correct).length
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((o, i) => (
          <OptionRow
            key={o.id}
            index={i}
            text={o.text}
            correct={o.correct}
            onText={(text) => set(options.map((x) => (x.id === o.id ? { ...x, text } : x)))}
            onToggleCorrect={() => set(options.map((x) => (x.id === o.id ? { ...x, correct: !x.correct } : x)))}
            onRemove={options.length > MIN_OPTIONS ? () => set(options.filter((x) => x.id !== o.id)) : undefined}
          />
        ))}
        {options.length < MAX_OPTIONS && <AddOptionButton onClick={() => set([...options, { id: newOptionId(), text: '', correct: false }])} />}
      </div>
      {correctCount > 1 && <p className="text-sm text-fg-muted">{t('questionTypes.quizEditor.multiHint')}</p>}
    </div>
  )
}

export function PollEditor({ question, onChange }: ContentEditorProps<'poll'>) {
  const t = useT()
  const options = question.content.options
  const set = (next: typeof options) => onChange({ options: next })
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((o, i) => (
          <OptionRow
            key={o.id}
            index={i}
            text={o.text}
            onText={(text) => set(options.map((x) => (x.id === o.id ? { ...x, text } : x)))}
            onRemove={options.length > MIN_OPTIONS ? () => set(options.filter((x) => x.id !== o.id)) : undefined}
          />
        ))}
        {options.length < MAX_OPTIONS && <AddOptionButton onClick={() => set([...options, { id: newOptionId(), text: '' }])} />}
      </div>
      <p className="text-sm text-fg-muted">{t('questionTypes.pollEditor.hint')}</p>
    </div>
  )
}

export function TrueFalseEditor({ question, onChange }: ContentEditorProps<'true_false'>) {
  const t = useT()
  const choices = [
    { value: true, label: t('questionTypes.trueFalse.true'), slot: { color: 'teal', pattern: 'waves' } as const },
    { value: false, label: t('questionTypes.trueFalse.false'), slot: { color: 'vermilion', pattern: 'stripes' } as const },
  ]
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-fg-muted">{t('questionTypes.trueFalse.pickCorrect')}</legend>
      <div className="grid grid-cols-2 gap-3">
        {choices.map(({ value, label, slot }) => {
          const active = question.content.correct === value
          const c = COLOR_CLASSES[slot.color]
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ correct: value })}
              className={cn(
                'relative isolate flex min-h-28 items-center justify-center gap-3 overflow-hidden rounded-md border-[3px] border-edge font-display text-3xl font-extrabold transition-[transform,box-shadow,opacity] duration-150',
                c.bg,
                c.on,
                active ? 'shadow-block' : 'opacity-60 hover:opacity-90',
              )}
            >
              <span aria-hidden="true" className={cn('absolute inset-0 -z-10 opacity-25', PATTERN_CLASSES[slot.pattern], c.patternInk)} />
              {label}
              {active && (
                <span className="grid size-9 place-items-center rounded-full border-[3px] border-edge bg-success text-white">
                  <Check className="size-5" strokeWidth={3.5} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function TextAnswerEditor({ question, onChange }: ContentEditorProps<'text'>) {
  const t = useT()
  const { accepted } = question.content
  const set = (next: string[]) => onChange({ ...question.content, accepted: next })
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">{t('questionTypes.textEditor.accepted')}</legend>
      {accepted.map((value, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={value}
            maxLength={200}
            onChange={(e) => set(accepted.map((a, j) => (j === i ? e.target.value : a)))}
            placeholder={t('questionTypes.textEditor.acceptedPlaceholder')}
            aria-label={`${t('questionTypes.textEditor.accepted')} ${i + 1}`}
            className="h-12 font-display text-lg font-bold"
          />
          {accepted.length > 1 && (
            <IconButton label={t('questionTypes.textEditor.removeAccepted')} icon={<Trash2 className="size-4" />} onClick={() => set(accepted.filter((_, j) => j !== i))} />
          )}
        </div>
      ))}
      {accepted.length < 10 && (
        <Button variant="ghost" size="sm" className="self-start" icon={<Plus className="size-4" />} onClick={() => set([...accepted, ''])}>
          {t('questionTypes.textEditor.addAccepted')}
        </Button>
      )}
      <p className="text-sm text-fg-muted">{t('questionTypes.textEditor.acceptedHint')}</p>
    </fieldset>
  )
}

/** Dispatches the content editor for the question type. */
export function QuestionContentEditor({ question, onChange }: { question: Question; onChange: (q: Question) => void }) {
  switch (question.type) {
    case 'quiz':
      return <QuizEditor question={question} onChange={(content) => onChange({ ...question, content })} />
    case 'poll':
      return <PollEditor question={question} onChange={(content) => onChange({ ...question, content })} />
    case 'true_false':
      return <TrueFalseEditor question={question} onChange={(content) => onChange({ ...question, content })} />
    case 'text':
      return <TextAnswerEditor question={question} onChange={(content) => onChange({ ...question, content })} />
  }
}
