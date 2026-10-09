import { memo, useId } from 'react'
import { cn } from '@/lib/cn'
import type { AvatarConfig } from './avatar'
import { resolveAvatar } from './avatar'
import { ACCESSORIES, DEEP, EYES, HEADS, HEX, INK, MOUTHS, PatternDef, TOPS } from './parts'

interface AvatarFaceProps {
  config: AvatarConfig
  /** Pixel size (square). */
  size?: number
  /** Accessible name; omit when a visible name sits next to the avatar. */
  title?: string
  className?: string
}

/**
 * Renders an avatar config as inline SVG. Deterministic: same config, same
 * drawing. Unknown part ids (newer data) fall back to safe defaults.
 */
export const AvatarFace = memo(function AvatarFace({ config, size = 40, title, className }: AvatarFaceProps) {
  const uid = useId().replace(/:/g, '')
  const head = HEADS[config.head] ?? HEADS.block!
  const primary = HEX[config.primary]
  const secondary = HEX[config.secondary]
  const patternId = `av-pat-${uid}`
  const clipId = `av-clip-${uid}`
  const hasPattern = config.pattern !== 'none'
  const eyes = (EYES[config.eyes] ?? EYES.dots!)({ secondary })
  const mouth = (MOUTHS[config.mouth] ?? MOUTHS.smile!)()
  const top = (TOPS[config.top] ?? TOPS.none!)({ secondary, hair: DEEP[config.secondary] })
  const accessory = (ACCESSORIES[config.accessory] ?? ACCESSORIES.none!)({ secondary })

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <defs>
        {hasPattern && <PatternDef id={patternId} kind={config.pattern} color={secondary} />}
        <clipPath id={clipId}>{head.shape({})}</clipPath>
      </defs>
      <g transform={`rotate(${head.rotate} 50 58)`}>
        {/* hard offset shadow, Tilt's signature */}
        <g transform="translate(4 4)">{head.shape({ fill: INK })}</g>
        {head.shape({ fill: primary })}
        {hasPattern && <g clipPath={`url(#${clipId})`}>{head.shape({ fill: `url(#${patternId})`, opacity: 0.55 })}</g>}
        {head.shape({ fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' })}
        {eyes}
        {mouth}
        {accessory}
      </g>
      {top}
    </svg>
  )
})

/**
 * Avatar of a player or profile: their saved config, or the one derived from
 * their name. `framed` puts it on a tilted paper tile so the ink outline stays
 * visible on dark screens (live game stage).
 */
export function PersonAvatar({
  config,
  name,
  size = 40,
  title,
  className,
  framed = false,
}: {
  config: unknown
  name: string
  size?: number
  title?: string
  className?: string
  framed?: boolean
}) {
  const face = <AvatarFace config={resolveAvatar(config, name)} size={framed ? Math.round(size * 0.82) : size} title={title} />
  if (!framed) return <span className={cn('inline-flex shrink-0', className)}>{face}</span>
  return (
    <span
      className={cn('inline-grid shrink-0 -rotate-3 place-items-center rounded-md border-2 border-black bg-paper shadow-[3px_3px_0_0_#000]', className)}
      style={{ width: size, height: size }}
    >
      {face}
    </span>
  )
}
