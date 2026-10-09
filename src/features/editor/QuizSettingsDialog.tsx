import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { QuizCover } from '@/features/quizzes/QuizCover'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES, PALETTE, PATTERN_CLASSES, PATTERNS } from '@/lib/palette'
import { QUIZ_CATEGORIES, QUIZ_LANGUAGES, type QuizCategory } from '@/types/database'
import { useT } from '@/i18n/I18nProvider'
import { MediaField } from './MediaField'

const MAX_TAGS = 8

/** Same rule as the SQL check constraint on quiz_tags.tag. */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeTag(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9à-ÿ-]/g, '')
    .replace(/^-+/, '')
    .slice(0, 30)
}

export function QuizSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const meta = useEditorStore((s) => s.meta)
  const setMeta = useEditorStore((s) => s.setMeta)
  const [tagInput, setTagInput] = useState('')

  function addTag() {
    const tag = normalizeTag(tagInput)
    if (tag && !meta.tags.includes(tag) && meta.tags.length < MAX_TAGS) setMeta({ tags: [...meta.tags, tag] })
    setTagInput('')
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && !tagInput && meta.tags.length) {
      setMeta({ tags: meta.tags.slice(0, -1) })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('editor.settingsTitle')}
      size="lg"
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
    >
      <div className="grid gap-6 md:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-4">
          <Field label={t('editor.meta.title')}>
            {({ id }) => <Input id={id} value={meta.title} maxLength={120} onChange={(e) => setMeta({ title: e.target.value })} placeholder={t('editor.titlePlaceholder')} />}
          </Field>
          <Field label={t('editor.meta.description')}>
            {({ id }) => (
              <Textarea id={id} value={meta.description} maxLength={1000} onChange={(e) => setMeta({ description: e.target.value })} placeholder={t('editor.meta.descriptionPlaceholder')} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('editor.meta.category')}>
              {({ id }) => (
                <Select id={id} value={meta.category} onChange={(e) => setMeta({ category: e.target.value as QuizCategory })}>
                  {QUIZ_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`categories.${c}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('editor.meta.language')}>
              {({ id }) => (
                <Select id={id} value={meta.language} onChange={(e) => setMeta({ language: e.target.value })}>
                  {QUIZ_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {t(`languages.${l}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field label={t('editor.meta.tags')} hint={t('editor.meta.tagsHint')}>
            {({ id, describedBy }) => (
              <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border-2 border-line bg-surface px-2 py-1.5 focus-within:border-cobalt dark:focus-within:border-lime">
                {meta.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-xs bg-surface-2 py-0.5 pr-0.5 pl-2 text-sm font-semibold">
                    #{tag}
                    <button type="button" aria-label={`${t('common.delete')} ${tag}`} onClick={() => setMeta({ tags: meta.tags.filter((x) => x !== tag) })} className="rounded-xs p-0.5 hover:bg-surface-3">
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                {meta.tags.length < MAX_TAGS && (
                  <input
                    id={id}
                    aria-describedby={describedBy}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKey}
                    onBlur={addTag}
                    placeholder={t('editor.meta.tagsPlaceholder')}
                    className="min-w-32 flex-1 bg-transparent px-1 text-sm focus:outline-none"
                  />
                )}
              </div>
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-sm font-semibold">{t('editor.meta.cover')}</span>
          <QuizCover
            color={meta.cover_color}
            pattern={meta.cover_pattern}
            imagePath={meta.cover_image_path}
            title={meta.title || t('quizzes.untitled')}
            className="rounded-md border-2 border-edge"
          />
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-fg-muted">{t('editor.meta.coverColor')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={meta.cover_color === c}
                  aria-label={t(`colors.${c}`)}
                  title={t(`colors.${c}`)}
                  onClick={() => setMeta({ cover_color: c })}
                  className={cn('size-8 rounded-sm border-2 transition-transform duration-150', COLOR_CLASSES[c].bg, meta.cover_color === c ? '-rotate-6 border-edge shadow-block-sm' : 'border-transparent hover:-rotate-3')}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-fg-muted">{t('editor.meta.coverPattern')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {PATTERNS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={meta.cover_pattern === p}
                  aria-label={t(`patterns.${p}`)}
                  title={t(`patterns.${p}`)}
                  onClick={() => setMeta({ cover_pattern: p })}
                  className={cn('size-8 rounded-sm border-2 bg-surface-2 text-fg-subtle', PATTERN_CLASSES[p], meta.cover_pattern === p ? 'border-edge text-fg' : 'border-line')}
                />
              ))}
            </div>
          </fieldset>
          <MediaField
            compact
            label={t('editor.meta.coverImage')}
            value={meta.cover_image_path ? { path: meta.cover_image_path, alt: '' } : null}
            onChange={(m) => setMeta({ cover_image_path: m?.path ?? null })}
          />
        </div>
      </div>
    </Dialog>
  )
}
