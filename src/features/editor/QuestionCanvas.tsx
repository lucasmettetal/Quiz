import { useCallback } from 'react'
import { FilePlus2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/States'
import { useEditorStore } from '@/stores/editorStore'
import { QuestionContentEditor } from '@/features/questions/ui/Editors'
import type { Question } from '@/features/questions/model'
import { useT } from '@/i18n/I18nProvider'
import { MediaField } from './MediaField'

export function QuestionCanvas({ onAdd }: { onAdd: () => void }) {
  const t = useT()
  const question = useEditorStore((s) => s.questions.find((q) => q.id === s.selectedId) ?? null)
  const index = useEditorStore((s) => s.questions.findIndex((q) => q.id === s.selectedId))
  const update = useEditorStore((s) => s.updateQuestion)
  const onChange = useCallback((q: Question) => update(q), [update])

  if (!question) {
    return (
      <div className="grid h-full place-items-center">
        <EmptyState
          icon={<FilePlus2 />}
          color="lime"
          pattern="checker"
          title={t('editor.emptyTitle')}
          description={t('editor.emptyText')}
          action={
            <Button size="lg" onClick={onAdd}>
              {t('editor.addQuestion')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div key={question.id} className="mx-auto flex w-full max-w-4xl animate-fade-up flex-col gap-6 px-4 py-6 sm:px-8 lg:py-10">
      <p className="text-center text-xs font-bold tracking-widest text-fg-subtle uppercase">{t('editor.questionNumber', { n: index + 1 })}</p>
      <label className="sr-only" htmlFor="question-prompt">
        {t('editor.promptLabel')}
      </label>
      <textarea
        id="question-prompt"
        value={question.prompt}
        onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        maxLength={500}
        rows={2}
        placeholder={t('editor.promptPlaceholder')}
        className="w-full resize-none rounded-md border-2 border-transparent bg-surface px-4 py-4 text-center font-display text-[clamp(1.5rem,2.6vw,2.25rem)] leading-tight font-bold shadow-[0_2px_0_0_var(--tilt-line)] [field-sizing:content] placeholder:text-fg-subtle hover:border-line focus:border-cobalt focus:outline-none dark:focus:border-lime"
      />
      <MediaField value={question.media} onChange={(media) => onChange({ ...question, media })} />
      <section aria-label={t('editor.answersTitle')}>
        <QuestionContentEditor question={question} onChange={onChange} />
      </section>
    </div>
  )
}
