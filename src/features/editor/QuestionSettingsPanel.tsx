import { AlertTriangle, CheckCircle2, Clock, Trophy } from 'lucide-react'
import { Switch } from '@/components/ui/misc'
import { useEditorStore } from '@/stores/editorStore'
import { questionIssues, questionTypes } from '@/features/questions/registry'
import { POINT_VALUES, QUESTION_TYPES, TIME_LIMITS, type Points } from '@/features/questions/model'
import { QUESTION_TYPE_META } from '@/features/questions/ui/typeMeta'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'

function PanelSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b-2 border-line px-4 py-4 last:border-b-0">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-widest text-fg-subtle uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

const chip = (active: boolean) =>
  cn(
    'h-9 rounded-sm border-2 text-sm font-bold tabular transition-colors duration-150',
    active ? 'border-edge bg-ink text-paper dark:bg-paper dark:text-ink' : 'border-line text-fg-muted hover:border-fg-subtle hover:text-fg',
  )

export function QuestionSettingsPanel() {
  const t = useT()
  const question = useEditorStore((s) => s.questions.find((q) => q.id === s.selectedId) ?? null)
  const update = useEditorStore((s) => s.updateQuestion)
  const changeType = useEditorStore((s) => s.changeType)
  if (!question) return null

  const issues = questionIssues(question)
  const graded = questionTypes[question.type].graded
  const pointLabels: Record<Points, string> = {
    0: t('editor.panel.pointsNone'),
    1000: t('editor.panel.pointsStandard'),
    2000: t('editor.panel.pointsDouble'),
  }

  return (
    <aside aria-label={t('common.settings')} className="flex flex-col">
      <PanelSection title={t('editor.panel.type')}>
        <div role="radiogroup" aria-label={t('editor.panel.type')} className="grid grid-cols-2 gap-1.5">
          {QUESTION_TYPES.map((type) => {
            const meta = QUESTION_TYPE_META[type]
            const Icon = meta.icon
            const active = question.type === type
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => changeType(question.id, type)}
                className={cn(
                  'flex items-center gap-2 rounded-sm border-2 px-2 py-2 text-left text-xs font-bold transition-colors duration-150',
                  active ? 'border-edge bg-surface-2' : 'border-line text-fg-muted hover:border-fg-subtle',
                )}
              >
                <span className={cn('grid size-6 shrink-0 place-items-center rounded-xs', COLOR_CLASSES[meta.color].bg, COLOR_CLASSES[meta.color].on)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="leading-tight">{t(`questionTypes.${type}.name`)}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-fg-subtle">{t('editor.panel.changeTypeWarning')}</p>
      </PanelSection>

      <PanelSection title={t('editor.panel.time')} icon={<Clock className="size-3.5" />}>
        <div role="radiogroup" aria-label={t('editor.panel.time')} className="grid grid-cols-5 gap-1.5">
          {TIME_LIMITS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={question.time_limit_s === s} onClick={() => update({ ...question, time_limit_s: s })} className={chip(question.time_limit_s === s)}>
              {s >= 60 && s % 60 === 0 ? `${s / 60}′` : s}
            </button>
          ))}
        </div>
      </PanelSection>

      {graded && (
        <PanelSection title={t('editor.panel.points')} icon={<Trophy className="size-3.5" />}>
          <div role="radiogroup" aria-label={t('editor.panel.points')} className="grid grid-cols-3 gap-1.5">
            {POINT_VALUES.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={question.points === p} onClick={() => update({ ...question, points: p })} className={cn(chip(question.points === p), 'h-auto py-1.5')}>
                <span className="block">{pointLabels[p]}</span>
                <span className="block text-[10px] font-semibold opacity-70">{p}</span>
              </button>
            ))}
          </div>
        </PanelSection>
      )}

      {question.type === 'text' && (
        <PanelSection title={t('editor.panel.advanced')}>
          <Switch
            checked={question.content.caseSensitive}
            onChange={(caseSensitive) => update({ ...question, content: { ...question.content, caseSensitive } })}
            label={t('editor.panel.caseSensitive')}
            description={t('editor.panel.caseSensitiveHint')}
          />
        </PanelSection>
      )}

      <PanelSection title={issues.length ? t('editor.invalid') : t('editor.valid')}>
        {issues.length ? (
          <ul className="flex flex-col gap-1.5">
            {issues.map((issue) => (
              <li key={issue} className="flex items-start gap-2 text-sm text-amber-deep">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t(`editor.issues.${issue}`)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> {t('editor.valid')}
          </p>
        )}
      </PanelSection>
    </aside>
  )
}
