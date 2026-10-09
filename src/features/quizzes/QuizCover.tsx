import { cn } from '@/lib/cn'
import { mediaPublicUrl } from '@/lib/supabase'
import { PatternBlock } from '@/components/ui/misc'
import type { PaletteColor, PatternName } from '@/lib/palette'

interface QuizCoverProps {
  color: PaletteColor
  pattern: PatternName
  imagePath?: string | null
  title: string
  className?: string
  children?: React.ReactNode
}

/**
 * A quiz cover is its color + pattern, with the title's initial set huge and
 * tilted; an uploaded image replaces the pattern when present.
 */
export function QuizCover({ color, pattern, imagePath, title, className, children }: QuizCoverProps) {
  const image = mediaPublicUrl(imagePath)
  return (
    <PatternBlock color={color} pattern={pattern} intensity="subtle" className={cn('aspect-[16/9]', className)}>
      {image ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="absolute -right-2 -bottom-8 -rotate-[10deg] font-display text-[7.5rem] leading-none font-black opacity-90 transition-transform duration-300 group-hover:-rotate-3"
        >
          {title.trim().charAt(0).toUpperCase() || '?'}
        </span>
      )}
      {children}
    </PatternBlock>
  )
}
