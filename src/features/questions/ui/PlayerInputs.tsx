import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AnswerTile, type AnswerTileState } from '@/features/game/components/AnswerTile'
import { cn } from '@/lib/cn'
import { answerSlot, type AnswerSlot } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'
import type { AnswerMap, AnyAnswer, QuestionType } from '../model'
import type { PublicQuestion, PublicQuestionOf, Solution } from '../public'

export interface PlayerInputProps<T extends QuestionType> {
  question: PublicQuestionOf<T>
  onSubmit: (answer: AnswerMap[T]) => void
  /** The answer already sent (locks the input and highlights it). */
  submitted: AnswerMap[T] | null
  disabled?: boolean
  solution?: Solution | null
}

function tileState(id: string, chosen: string[], solution: Solution | null | undefined, locked: boolean): AnswerTileState {
  const isChosen = chosen.includes(id)
  if (solution && 'optionIds' in solution) {
    if (solution.optionIds.includes(id)) return 'correct'
    return isChosen ? 'wrong' : 'dimmed'
  }
  if (isChosen) return 'selected'
  return locked ? 'dimmed' : 'idle'
}

function ChoiceInput({ question, onSubmit, submitted, disabled, solution }: PlayerInputProps<'quiz' | 'poll'>) {
  const t = useT()
  const multi = 'multi' in question.content && question.content.multi
  const [picked, setPicked] = useState<string[]>([])
  const locked = Boolean(submitted) || Boolean(disabled)
  const chosen = submitted?.optionIds ?? picked
  const options = question.content.options

  function tap(id: string) {
    if (locked) return
    if (!multi) return onSubmit({ optionIds: [id] })
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  return (
    <div className="flex flex-col gap-3">
      {multi && !locked && <p className="text-center text-sm font-semibold opacity-80">{t('player.selectAll')}</p>}
      <div className={cn('grid gap-3', options.length > 2 ? 'grid-cols-1 min-[420px]:grid-cols-2' : 'grid-cols-1')}>
        {options.map((o, i) => (
          <AnswerTile
            key={o.id}
            look={answerSlot(i)}
            label={o.text}
            size="lg"
            state={tileState(o.id, chosen, solution, locked)}
            aria-pressed={chosen.includes(o.id)}
            disabled={locked}
            onClick={() => tap(o.id)}
          />
        ))}
      </div>
      {multi && !locked && (
        <Button size="xl" variant="ink" disabled={picked.length === 0} onClick={() => onSubmit({ optionIds: picked })} iconRight={<Send className="size-5" />}>
          {t('player.submit')}
        </Button>
      )}
    </div>
  )
}

function TrueFalseInput({ onSubmit, submitted, disabled, solution }: PlayerInputProps<'true_false'>) {
  const t = useT()
  const locked = Boolean(submitted) || Boolean(disabled)
  const labels = { true: t('questionTypes.trueFalse.true'), false: t('questionTypes.trueFalse.false') }
  const slots: Record<'true' | 'false', AnswerSlot> = {
    true: { color: 'teal', pattern: 'waves', letter: labels.true.charAt(0) },
    false: { color: 'vermilion', pattern: 'stripes', letter: labels.false.charAt(0) },
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {([true, false] as const).map((value) => {
        const key = value ? 'true' : 'false'
        const isChosen = submitted?.value === value
        let state: AnswerTileState = isChosen ? 'selected' : locked ? 'dimmed' : 'idle'
        if (solution && 'value' in solution) state = solution.value === value ? 'correct' : isChosen ? 'wrong' : 'dimmed'
        return (
          <AnswerTile
            key={key}
            look={slots[key]}
            label={labels[key]}
            size="lg"
            state={state}
            className="min-h-40 flex-col justify-center text-center sm:min-h-48 [&>span:last-child]:flex-none [&>span:last-child]:text-center"
            aria-pressed={isChosen}
            disabled={locked}
            onClick={() => !locked && onSubmit({ value })}
          />
        )
      })}
    </div>
  )
}

function TextInput({ onSubmit, submitted, disabled, solution }: PlayerInputProps<'text'>) {
  const t = useT()
  const [text, setText] = useState('')
  const locked = Boolean(submitted) || Boolean(disabled)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (text.trim()) onSubmit({ text: text.trim().slice(0, 200) })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="sr-only" htmlFor="typed-answer">
        {t('player.typeAnswer')}
      </label>
      <input
        id="typed-answer"
        value={submitted?.text ?? text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
        maxLength={200}
        autoComplete="off"
        autoCapitalize="off"
        enterKeyHint="send"
        placeholder={t('player.typeAnswer')}
        className="h-16 w-full rounded-md border-[3px] border-edge bg-paper px-4 font-display text-2xl font-bold text-ink placeholder:text-ink/35 focus:outline-none focus-visible:ring-4 focus-visible:ring-cobalt disabled:opacity-80"
      />
      {!locked && (
        <Button type="submit" size="xl" variant="ink" disabled={!text.trim()} iconRight={<Send className="size-5" />}>
          {t('player.submit')}
        </Button>
      )}
      {solution && 'accepted' in solution && (
        <p className="rounded-md bg-paper/95 px-4 py-3 text-ink">
          <span className="text-sm font-semibold opacity-70">{t('player.theAnswerWas')} </span>
          <span className="font-display text-xl font-bold">{solution.accepted.join(' · ')}</span>
        </p>
      )}
    </form>
  )
}

/** Dispatches to the right input for the question type. */
export function PlayerAnswerInput({
  question,
  onSubmit,
  submitted,
  disabled,
  solution,
}: {
  question: PublicQuestion
  onSubmit: (answer: AnyAnswer) => void
  submitted: AnyAnswer | null
  disabled?: boolean
  solution?: Solution | null
}) {
  // Each input only reads the answer shape of its own type.
  const common = { onSubmit, disabled, solution } as const
  switch (question.type) {
    case 'quiz':
    case 'poll':
      return <ChoiceInput key={question.id} question={question} submitted={submitted as AnswerMap['quiz'] | null} {...common} />
    case 'true_false':
      return <TrueFalseInput key={question.id} question={question} submitted={submitted as AnswerMap['true_false'] | null} {...common} />
    case 'text':
      return <TextInput key={question.id} question={question} submitted={submitted as AnswerMap['text'] | null} {...common} />
  }
}
