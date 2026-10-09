import { cn } from '@/lib/cn'

/**
 * Wordmark: "tilt" set in the display face, the dot of the i replaced by a
 * tilted vermilion square — the brand's recurring shape.
 */
export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn('inline-flex items-baseline font-display text-2xl leading-none font-extrabold tracking-tight', className)}>
      <span aria-hidden="true">t</span>
      <span aria-hidden="true" className="relative inline-block">
        ı
        <span
          className={cn(
            'absolute -top-[0.22em] left-1/2 size-[0.3em] -translate-x-1/2 rotate-12 rounded-[2px]',
            mono ? 'bg-current' : 'bg-primary',
          )}
        />
      </span>
      <span aria-hidden="true">lt</span>
      <span className="sr-only">Tilt</span>
    </span>
  )
}

/** Square app mark for small spaces. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid size-9 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-primary font-display text-lg font-black text-white shadow-block-sm',
        className,
      )}
    >
      t
    </span>
  )
}
