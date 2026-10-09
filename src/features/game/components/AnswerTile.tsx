import type { ComponentProps, ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES, PATTERN_CLASSES, type AnswerSlot } from '@/lib/palette'

export type AnswerTileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed'

interface AnswerTileProps extends Omit<ComponentProps<'button'>, 'children'> {
  look: AnswerSlot
  label: ReactNode
  state?: AnswerTileState
  size?: 'md' | 'lg' | 'stage'
  /** Shown at the right edge (e.g. vote count on the host screen). */
  trailing?: ReactNode
  /** Render as a non-interactive block (host screen). */
  asStatic?: boolean
}

/**
 * The answer block: color + pattern + letter badge, so it reads without color
 * vision and from the back of a room. Selected answers sink into their shadow,
 * correct ones get a check, wrong ones fade.
 */
export function AnswerTile({ look: slot, label, state = 'idle', size = 'md', trailing, asStatic, className, ...rest }: AnswerTileProps) {
  const c = COLOR_CLASSES[slot.color]
  const sizes = {
    md: 'min-h-16 gap-3 px-3 py-3 text-base',
    lg: 'min-h-24 gap-3 px-4 py-4 text-lg sm:min-h-28 sm:text-xl',
    stage: 'min-h-24 gap-4 px-5 py-4 text-[clamp(1.25rem,2.4vw,2.25rem)] lg:min-h-32',
  }
  const badge = {
    md: 'size-9 text-lg',
    lg: 'size-11 text-xl sm:size-12',
    stage: 'size-[clamp(2.75rem,4vw,4rem)] text-[clamp(1.25rem,2.4vw,2rem)]',
  }
  const content = (
    <>
      <span aria-hidden="true" className={cn('absolute inset-0 -z-10', PATTERN_CLASSES[slot.pattern], c.patternInk, 'opacity-30')} />
      <span
        aria-hidden="true"
        className={cn(
          'grid shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-paper font-display font-black text-ink',
          badge[size],
        )}
      >
        {state === 'correct' ? <Check className="size-2/3" strokeWidth={3.5} /> : state === 'wrong' ? <X className="size-2/3" strokeWidth={3.5} /> : slot.letter}
      </span>
      <span className="min-w-0 flex-1 text-left font-display leading-tight font-bold [overflow-wrap:anywhere]">{label}</span>
      {trailing}
    </>
  )
  const classes = cn(
    'relative isolate flex w-full items-center overflow-hidden rounded-md border-[3px] border-edge select-none',
    c.bg,
    c.on,
    sizes[size],
    'transition-[transform,box-shadow,opacity,filter] duration-150 ease-out',
    state === 'idle' && 'shadow-block',
    !asStatic && state === 'idle' && 'hover:-translate-y-0.5 hover:shadow-block-lg active:translate-x-1 active:translate-y-1 active:shadow-none',
    state === 'selected' && 'translate-x-1 translate-y-1 shadow-none ring-4 ring-fg ring-offset-2 ring-offset-bg',
    state === 'correct' && 'z-10 scale-[1.02] shadow-block-lg',
    state === 'wrong' && 'opacity-40 saturate-50',
    state === 'dimmed' && 'opacity-35 saturate-50',
    className,
  )
  if (asStatic) return <div className={classes}>{content}</div>
  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  )
}
