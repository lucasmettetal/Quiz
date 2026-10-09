import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, RotateCcw, Shuffle } from 'lucide-react'
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
  /** Hide the built-in preview when the page already shows the avatar big enough. */
  showPreview?: boolean
  unlocked?: ReadonlySet<string>
}

/** Small "bump" each time the avatar changes, so every tap visibly does something. */
export function AvatarPreview({ config, size, className }: { config: AvatarConfig; size: number; className?: string }) {
  return (
    <span key={JSON.stringify(config)} className={cn('inline-flex animate-[avatar-bump_160ms_var(--ease-snap)]', className)}>
      <AvatarFace config={config} size={size} />
    </span>
  )
}

/**
 * Compact, mobile-first avatar editor.
 * Hierarchy: previous/next (primary edit action) > Shuffle (secondary) > Reset (tertiary).
 * The control area keeps a fixed height across categories, so nothing jumps.
 */
export function AvatarEditor({ value, onChange, resetTo, tone = 'surface', showPreview = true, unlocked }: AvatarEditorProps) {
  const t = useT()
  const id = useId()
  const [tab, setTab] = useState<Tab>('head')
  const [colorSlot, setColorSlot] = useState<'primary' | 'secondary'>('primary')
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  // Which edges of the category carousel hide more tabs (drives the edge fades).
  const [edges, setEdges] = useState({ start: false, end: true })
  const onTabsScroll = (el: HTMLElement) =>
    setEdges({ start: el.scrollLeft > 8, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 })
  const stage = tone === 'stage'
  const parts = tab === 'colors' ? [] : availableParts(tab, unlocked)
  const index = tab === 'colors' ? 0 : Math.max(0, parts.findIndex((p) => p.id === value[tab]))
  const category = t(`avatar.categories.${tab}`)

  // Keep the selected tab in view inside the snap carousel.
  useEffect(() => {
    tabRefs.current[tab]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [tab])

  function onTabKey(e: KeyboardEvent) {
    const i = TABS.indexOf(tab)
    const next =
      e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length] : e.key === 'ArrowLeft' ? TABS[(i - 1 + TABS.length) % TABS.length] : e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS.at(-1) : null
    if (!next) return
    e.preventDefault()
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  // Stage = dark join screen; surface = Settings (light or dark theme).
  const ink = stage ? 'text-paper' : 'text-fg'
  const muted = stage ? 'text-paper/70' : 'text-fg-muted'
  const arrow =
    'grid size-14 shrink-0 place-items-center rounded-md border-[3px] border-black bg-paper text-ink shadow-[3px_3px_0_0_#000] ' +
    'transition-transform duration-100 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @md:flex-row @md:items-start">
        {showPreview && (
          <div className={cn('mx-auto grid size-32 shrink-0 -rotate-2 place-items-center rounded-lg border-[3px] border-black bg-paper shadow-[4px_4px_0_0_#000]')}>
            <AvatarPreview config={value} size={104} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Categories: one-line snap carousel, scrollbar hidden, edges faded when it overflows. */}
          <div
            role="tablist"
            aria-label={t('avatar.title')}
            onKeyDown={onTabKey}
            onScroll={(e) => onTabsScroll(e.currentTarget)}
            style={{
              maskImage: `linear-gradient(90deg, ${edges.start ? 'transparent' : '#000'}, #000 16px, #000 calc(100% - 16px), ${edges.end ? 'transparent' : '#000'})`,
            }}
            className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-1.5 overflow-x-auto scroll-smooth px-1 py-1 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
          >
            {TABS.map((tabId) => {
              const selected = tab === tabId
              return (
                <button
                  key={tabId}
                  ref={(el) => {
                    tabRefs.current[tabId] = el
                  }}
                  id={`${id}-tab-${tabId}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${id}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(tabId)}
                  className={cn(
                    'relative h-11 shrink-0 snap-start rounded-md border-2 px-3.5 text-sm font-bold whitespace-nowrap transition-colors duration-150',
                    selected
                      ? 'border-black bg-paper text-ink shadow-[2px_2px_0_0_#000]'
                      : stage
                        ? 'border-white/15 text-paper/80 hover:border-white/40 hover:text-paper'
                        : 'border-line text-fg-muted hover:border-fg-subtle hover:text-fg',
                  )}
                >
                  {t(`avatar.categories.${tabId}`)}
                  {/* Selection is also shown by shape, not color alone. */}
                  {selected && <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-ink" />}
                </button>
              )
            })}
          </div>

          <div
            id={`${id}-panel`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab}`}
            className="flex h-[9.75rem] flex-col justify-center @[17rem]:h-[8.5rem]"
          >
            {tab === 'colors' ? (
              <div className="flex flex-col gap-2">
                <div role="radiogroup" aria-label={t('avatar.categories.colors')} className={cn('grid grid-cols-2 gap-1 rounded-md border-2 p-0.5', stage ? 'border-white/15' : 'border-line')}>
                  {(['primary', 'secondary'] as const).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      role="radio"
                      aria-checked={colorSlot === slot}
                      onClick={() => setColorSlot(slot)}
                      className={cn(
                        'flex h-11 items-center justify-center gap-2 rounded-sm text-sm font-bold transition-colors duration-150',
                        colorSlot === slot ? 'bg-paper text-ink' : muted,
                      )}
                    >
                      <span aria-hidden="true" className={cn('size-3.5 rounded-xs border-2 border-black', COLOR_CLASSES[value[slot]].bg)} />
                      {t(`avatar.${slot}`)}
                    </button>
                  ))}
                </div>
                <div role="radiogroup" aria-label={t(`avatar.${colorSlot}`)} className="grid grid-cols-3 gap-1.5 @[17rem]:grid-cols-6">
                  {AVATAR_COLORS.map((c) => {
                    const checked = value[colorSlot] === c
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={t(`colors.${c}`)}
                        title={t(`colors.${c}`)}
                        onClick={() => onChange(setColor(value, colorSlot, c))}
                        className={cn(
                          'grid h-11 place-items-center rounded-md border-[3px] border-black transition-transform duration-150',
                          COLOR_CLASSES[c].bg,
                          COLOR_CLASSES[c].on,
                          checked ? '-rotate-6 shadow-[2px_2px_0_0_#000]' : 'opacity-85 hover:opacity-100',
                        )}
                      >
                        {checked && <Check className="size-5" strokeWidth={3.5} aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button type="button" className={arrow} aria-label={`${t('avatar.previous')} — ${category}`} onClick={() => onChange(cyclePart(value, tab, -1, unlocked))}>
                  <ChevronLeft className="size-7" strokeWidth={3} />
                </button>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2" aria-live="polite">
                  <p className={cn('font-display text-lg leading-none font-bold', ink)}>
                    <span className="sr-only">{t('avatar.position', { category, n: index + 1, total: parts.length })}</span>
                    <span aria-hidden="true">
                      {category} <span className={cn('tabular', muted)}>{index + 1}/{parts.length}</span>
                    </span>
                  </p>
                  {/* Position dots: the current one is longer (shape, not only color). */}
                  <span aria-hidden="true" className="flex flex-wrap justify-center gap-1">
                    {parts.map((p, i) => (
                      <span key={p.id} className={cn('h-2 rounded-full transition-all duration-150', i === index ? 'w-5 bg-lime ring-2 ring-black' : cn('w-2', stage ? 'bg-white/30' : 'bg-fg-subtle/50'))} />
                    ))}
                  </span>
                </div>
                <button type="button" className={arrow} aria-label={`${t('avatar.next')} — ${category}`} onClick={() => onChange(cyclePart(value, tab, 1, unlocked))}>
                  <ChevronRight className="size-7" strokeWidth={3} />
                </button>
              </div>
            )}
          </div>

          {/* Secondary: shuffle. Tertiary: reset (text-only). */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onChange(randomAvatar(unlocked))}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-md border-2 px-4 text-sm font-bold transition-colors duration-150',
                stage ? 'border-white/40 text-paper hover:border-paper hover:bg-white/5' : 'border-line text-fg hover:border-fg-subtle',
              )}
            >
              <Shuffle className="size-4" aria-hidden="true" />
              {t('avatar.shuffle')}
            </button>
            <button
              type="button"
              onClick={() => onChange(resetTo)}
              className={cn('inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold underline-offset-4 hover:underline', muted)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t('avatar.reset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
