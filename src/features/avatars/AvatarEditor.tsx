import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'
import { AVATAR_COLORS, availableParts, type PartCategory } from './catalog'
import { cyclePart, randomAvatar, setColor, type AvatarConfig } from './avatar'
import { AvatarFace } from './AvatarFace'

type Tab = PartCategory | 'colors'
const TABS: Tab[] = ['head', 'eyes', 'mouth', 'top', 'accessory', 'colors', 'pattern']

interface AvatarEditorProps {
  value: AvatarConfig
  onChange: (config: AvatarConfig) => void
  /** Config restored by "Reset" (usually the one generated from the name). */
  resetTo: AvatarConfig
  /** Visual context: the dark join screen or a regular surface. */
  tone?: 'stage' | 'surface'
  unlocked?: ReadonlySet<string>
}

/** Compact editor: live preview, one category at a time, previous/next, shuffle, reset. */
export function AvatarEditor({ value, onChange, resetTo, tone = 'surface', unlocked }: AvatarEditorProps) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('head')
  const stage = tone === 'stage'
  const parts = tab === 'colors' ? [] : availableParts(tab, unlocked)
  const index = tab === 'colors' ? 0 : parts.findIndex((p) => p.id === value[tab])
  const category = t(`avatar.categories.${tab}`)

  const control = cn(
    'grid size-11 place-items-center rounded-md border-2 transition-colors duration-150',
    stage ? 'border-white/25 text-paper hover:bg-white/10' : 'border-line hover:border-fg-subtle',
  )

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className={cn('mx-auto grid size-32 shrink-0 -rotate-2 place-items-center rounded-lg border-[3px]', stage ? 'border-black bg-paper' : 'border-edge bg-surface-2')}>
        <AvatarFace config={value} size={104} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div role="tablist" aria-label={t('avatar.title')} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'shrink-0 rounded-sm px-2.5 py-1.5 text-xs font-bold transition-colors duration-150',
                tab === id
                  ? stage
                    ? 'bg-paper text-ink'
                    : 'bg-ink text-paper dark:bg-paper dark:text-ink'
                  : stage
                    ? 'text-paper/75 hover:bg-white/10'
                    : 'text-fg-muted hover:bg-surface-2',
              )}
            >
              {t(`avatar.categories.${id}`)}
            </button>
          ))}
        </div>

        {tab === 'colors' ? (
          <div className="flex flex-col gap-2">
            {(['primary', 'secondary'] as const).map((slot) => (
              <fieldset key={slot}>
                <legend className={cn('mb-1 text-xs font-semibold', stage ? 'text-paper/75' : 'text-fg-muted')}>{t(`avatar.${slot}`)}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={value[slot] === c}
                      aria-label={t(`colors.${c}`)}
                      title={t(`colors.${c}`)}
                      onClick={() => onChange(setColor(value, slot, c))}
                      className={cn(
                        'size-9 rounded-sm border-[3px] transition-transform duration-150',
                        COLOR_CLASSES[c].bg,
                        value[slot] === c ? '-rotate-6 border-black shadow-[2px_2px_0_0_#000]' : stage ? 'border-white/20' : 'border-transparent',
                      )}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" className={control} aria-label={`${t('avatar.previous')} — ${category}`} onClick={() => onChange(cyclePart(value, tab, -1, unlocked))}>
              <ChevronLeft className="size-5" />
            </button>
            <p aria-live="polite" className={cn('flex-1 text-center text-sm font-semibold tabular', stage ? 'text-paper' : 'text-fg')}>
              {t('avatar.position', { category, n: index + 1, total: parts.length })}
            </p>
            <button type="button" className={control} aria-label={`${t('avatar.next')} — ${category}`} onClick={() => onChange(cyclePart(value, tab, 1, unlocked))}>
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant={stage ? 'paper' : 'secondary'} icon={<Shuffle className="size-4" />} onClick={() => onChange(randomAvatar(unlocked))}>
            {t('avatar.shuffle')}
          </Button>
          <Button size="sm" variant="ghost" className={stage ? 'text-paper/80 hover:bg-white/10 hover:text-paper' : ''} icon={<RotateCcw className="size-4" />} onClick={() => onChange(resetTo)}>
            {t('avatar.reset')}
          </Button>
        </div>
      </div>
    </div>
  )
}
