import { Dialog } from '@/components/ui/Dialog'
import { PatternBlock } from '@/components/ui/misc'
import { questionTypes } from '@/features/questions/registry'
import { QUESTION_TYPES, type QuestionType } from '@/features/questions/model'
import { QUESTION_TYPE_META } from '@/features/questions/ui/typeMeta'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

/** Tiny visual sketch of each type, so the choice is made by eye. */
function TypeSketch({ type }: { type: QuestionType }) {
  const bar = 'h-2.5 rounded-xs border-2 border-edge bg-paper'
  switch (type) {
    case 'quiz':
      return (
        <div className="grid w-20 grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn(bar, i === 1 && 'bg-lime')} />
          ))}
        </div>
      )
    case 'true_false':
      return (
        <div className="flex gap-1.5 font-display text-sm font-black">
          <span className="grid size-8 place-items-center rounded-xs border-2 border-edge bg-paper text-ink">V</span>
          <span className="grid size-8 place-items-center rounded-xs border-2 border-edge bg-ink text-paper">F</span>
        </div>
      )
    case 'text':
      return (
        <div className="flex h-8 w-24 items-center rounded-xs border-2 border-edge bg-paper px-1.5">
          <span className="h-4 w-0.5 animate-pulse bg-ink" />
        </div>
      )
    case 'poll':
      return (
        <div className="flex h-9 items-end gap-1">
          {[60, 100, 35].map((h) => (
            <span key={h} className="w-4 rounded-t-xs border-2 border-edge bg-paper" style={{ height: `${h}%` }} />
          ))}
        </div>
      )
  }
}

export function TypePickerDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (type: QuestionType) => void }) {
  const t = useT()
  const groups = [
    { key: 'test' as const, label: t('questionTypes.categoryTest') },
    { key: 'collect' as const, label: t('questionTypes.categoryCollect') },
  ]
  return (
    <Dialog open={open} onClose={onClose} title={t('questionTypes.pickerTitle')} description={t('questionTypes.pickerLead')} size="lg">
      <div className="flex flex-col gap-6 pb-2">
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="mb-2 text-xs font-bold tracking-widest text-fg-subtle uppercase">{group.label}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {QUESTION_TYPES.filter((type) => questionTypes[type].category === group.key).map((type) => {
                const meta = QUESTION_TYPE_META[type]
                const Icon = meta.icon
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onPick(type)
                      onClose()
                    }}
                    className="group overflow-hidden rounded-md border-2 border-edge bg-surface text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-block focus-visible:shadow-block"
                  >
                    <PatternBlock color={meta.color} pattern={meta.pattern} intensity="subtle" className="flex h-20 items-center justify-between border-b-2 border-edge px-3">
                      <span className="grid size-10 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-paper text-ink transition-transform duration-150 group-hover:rotate-0">
                        <Icon className="size-5" />
                      </span>
                      <TypeSketch type={type} />
                    </PatternBlock>
                    <span className="block p-3">
                      <span className="block font-bold">{t(`questionTypes.${type}.name`)}</span>
                      <span className="block text-xs text-fg-muted">{t(`questionTypes.${type}.description`)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
