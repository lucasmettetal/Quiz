import { memo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toaster'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES } from '@/lib/palette'
import { useEditorStore } from '@/stores/editorStore'
import { questionIssues } from '@/features/questions/registry'
import type { Question } from '@/features/questions/model'
import { QUESTION_TYPE_META } from '@/features/questions/ui/typeMeta'
import { useT } from '@/i18n/I18nProvider'

const Thumb = memo(function Thumb({ question, index, selected }: { question: Question; index: number; selected: boolean }) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const select = useEditorStore((s) => s.select)
  const duplicate = useEditorStore((s) => s.duplicate)
  const remove = useEditorStore((s) => s.remove)
  const restore = useEditorStore((s) => s.restore)
  const meta = QUESTION_TYPE_META[question.type]
  const Icon = meta.icon
  const valid = questionIssues(question).length === 0
  const optionCount = question.type === 'quiz' || question.type === 'poll' ? question.content.options.length : question.type === 'true_false' ? 2 : 0

  function handleRemove() {
    const removed = remove(question.id)
    if (!removed) return
    // Deleting a question is cheap to undo, so no confirmation dialog.
    toast({ message: t('editor.questionDeleted'), action: { label: t('common.undo'), onClick: () => restore(removed.question, removed.index) } })
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative', isDragging && 'z-20')}
    >
      <div
        className={cn(
          'flex gap-1 rounded-md border-2 p-1.5 transition-[border-color,box-shadow,background-color] duration-150',
          selected ? 'border-edge bg-surface shadow-block-sm' : 'border-transparent hover:bg-surface-2',
          isDragging && 'rotate-2 shadow-block',
        )}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('editor.dragHandle', { n: index + 1 })}
          className="flex w-5 shrink-0 cursor-grab touch-none flex-col items-center gap-1 rounded-sm pt-1 text-fg-subtle hover:text-fg active:cursor-grabbing"
        >
          <span className="font-display text-sm font-bold text-fg">{index + 1}</span>
          <GripVertical className="size-4" />
        </button>
        <button type="button" onClick={() => select(question.id)} aria-current={selected || undefined} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className={cn('grid size-5 place-items-center rounded-xs', COLOR_CLASSES[meta.color].bg, COLOR_CLASSES[meta.color].on)}>
              <Icon className="size-3" aria-hidden="true" />
            </span>
            <span className="truncate text-[11px] font-semibold text-fg-subtle">{t(`questionTypes.${question.type}.name`)}</span>
            {!valid && <AlertTriangle className="ml-auto size-3.5 shrink-0 text-amber-deep" aria-label={t('editor.invalid')} />}
          </div>
          <p className={cn('mt-1 line-clamp-2 text-xs leading-snug font-semibold', !question.prompt && 'text-fg-subtle italic')}>
            {question.prompt || t('editor.promptPlaceholder')}
          </p>
          {optionCount > 0 && (
            <div className="mt-1.5 grid grid-cols-3 gap-0.5" aria-hidden="true">
              {Array.from({ length: Math.min(optionCount, 6) }, (_, i) => (
                <span key={i} className="h-1.5 rounded-full bg-surface-3" />
              ))}
            </div>
          )}
        </button>
      </div>
      <div className="absolute top-1 right-1 hidden gap-0.5 rounded-sm bg-surface group-focus-within:flex group-hover:flex">
        <IconButton size="sm" className="size-7" label={t('editor.duplicateQuestion')} icon={<Copy className="size-3.5" />} onClick={() => duplicate(question.id)} />
        <IconButton size="sm" className="size-7 hover:text-danger" label={t('editor.deleteQuestion')} icon={<Trash2 className="size-3.5" />} onClick={handleRemove} />
      </div>
    </li>
  )
})

export function QuestionList({ onAdd }: { onAdd: () => void }) {
  const t = useT()
  const ids = useEditorStore(useShallow((s) => s.questions.map((q) => q.id)))
  const questions = useEditorStore((s) => s.questions)
  const selectedId = useEditorStore((s) => s.selectedId)
  const move = useEditorStore((s) => s.move)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const invalidCount = questions.filter((q) => questionIssues(q).length > 0).length

  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) move(String(e.active.id), String(e.over.id))
  }

  return (
    <nav aria-label={t('editor.questionsList')} className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-xs font-bold tracking-widest text-fg-subtle uppercase">{t('editor.questionsList')}</h2>
        <span className="text-xs font-semibold text-fg-subtle tabular">{questions.length}</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
            {questions.map((q, i) => (
              <Thumb key={q.id} question={q} index={i} selected={q.id === selectedId} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="border-t-2 border-line p-2">
        {invalidCount > 0 && (
          <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-amber-deep">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            {t('editor.issuesCount', { count: invalidCount })}
          </p>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-line py-2.5 text-sm font-bold text-fg-muted transition-colors duration-150 hover:border-primary hover:text-primary"
        >
          <Plus className="size-4" /> {t('editor.addQuestion')}
        </button>
      </div>
    </nav>
  )
}
