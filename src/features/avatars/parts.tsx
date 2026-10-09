/* eslint-disable react-refresh/only-export-components -- drawing catalog, not a component module */
/**
 * Avatar parts, drawn on a 100×100 canvas. Each id here matches catalog.ts.
 * Style rules: thick ink outlines, flat fills, geometric shapes, a hard offset
 * shadow — legible at 24 px and on a projector. Features are drawn in ink so
 * they read on every body color.
 */
import type { ReactNode } from 'react'
import type { PaletteColor } from '@/lib/palette'

export const INK = '#17142b'
export const PAPER = '#faf6ee'

export const HEX: Record<PaletteColor, string> = {
  vermilion: '#f2471f',
  cobalt: '#2f5bea',
  lime: '#b8e62e',
  amber: '#ffb020',
  teal: '#12a594',
  orchid: '#c04bd9',
}

/** Darker shade of each color: hair, so it stays visible on dark screens too. */
export const DEEP: Record<PaletteColor, string> = {
  vermilion: '#c9330f',
  cobalt: '#1f43bd',
  lime: '#6f9410',
  amber: '#c27e00',
  teal: '#0b8073',
  orchid: '#9b2fb3',
}

const stroke = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

/* ------------------------------------------------------------------ heads */

/** Head silhouettes: a shape element factory (used for fill, clip and outline) + tilt. */
export const HEADS: Record<string, { shape: (props: Record<string, unknown>) => ReactNode; rotate: number }> = {
  block: { rotate: -6, shape: (p) => <rect x="18" y="28" width="64" height="62" rx="10" {...p} /> },
  tilt: { rotate: 0, shape: (p) => <path d="M26 28 L84 24 Q86 24 85 27 L78 90 Q78 92 75 92 L17 93 Q14 93 15 90 L23 31 Q23 28 26 28 Z" {...p} /> },
  pebble: { rotate: 4, shape: (p) => <ellipse cx="50" cy="60" rx="33" ry="31" {...p} /> },
  hex: { rotate: 0, shape: (p) => <path d="M33 28 H67 L84 59 L67 90 H33 L16 59 Z" {...p} /> },
  capsule: { rotate: -4, shape: (p) => <rect x="22" y="22" width="56" height="70" rx="28" {...p} /> },
  shield: { rotate: 3, shape: (p) => <path d="M18 30 H82 V60 Q82 84 50 94 Q18 84 18 60 Z" {...p} /> },
}

/* --------------------------------------------------------------- patterns */

export function PatternDef({ id, kind, color }: { id: string; kind: string; color: string }) {
  const common = { id, patternUnits: 'userSpaceOnUse' as const }
  switch (kind) {
    case 'stripes':
      return (
        <pattern {...common} width="10" height="10" patternTransform="rotate(-45)">
          <rect width="4" height="10" fill={color} />
        </pattern>
      )
    case 'dots':
      return (
        <pattern {...common} width="10" height="10">
          <circle cx="5" cy="5" r="2.2" fill={color} />
        </pattern>
      )
    case 'grid':
      return (
        <pattern {...common} width="11" height="11">
          <path d="M0 0 H11 M0 0 V11" stroke={color} strokeWidth="2" fill="none" />
        </pattern>
      )
    case 'waves':
      return (
        <pattern {...common} width="16" height="8">
          <path d="M0 6 Q4 1 8 6 T16 6" stroke={color} strokeWidth="2" fill="none" />
        </pattern>
      )
    case 'zigzag':
      return (
        <pattern {...common} width="12" height="8">
          <path d="M0 6 L3 2 L6 6 L9 2 L12 6" stroke={color} strokeWidth="2" fill="none" />
        </pattern>
      )
    case 'checker':
      return (
        <pattern {...common} width="12" height="12">
          <rect width="6" height="6" fill={color} />
          <rect x="6" y="6" width="6" height="6" fill={color} />
        </pattern>
      )
    default:
      return null
  }
}

/* ------------------------------------------------------------------- eyes */

export const EYES: Record<string, (c: { secondary: string }) => ReactNode> = {
  dots: () => (
    <g fill={INK}>
      <circle cx="38" cy="55" r="5" />
      <circle cx="62" cy="55" r="5" />
    </g>
  ),
  square: () => (
    <g>
      <rect x="32" y="49" width="11" height="11" rx="1.5" fill={INK} />
      <rect x="57" y="49" width="11" height="11" rx="1.5" fill={INK} />
      <rect x="34" y="51" width="3.5" height="3.5" fill={PAPER} />
      <rect x="59" y="51" width="3.5" height="3.5" fill={PAPER} />
    </g>
  ),
  visor: ({ secondary }) => (
    <g>
      <rect x="25" y="47" width="50" height="14" rx="4" fill={INK} />
      <rect x="30" y="51" width="16" height="4" rx="2" fill={secondary} />
    </g>
  ),
  wink: () => (
    <g>
      <circle cx="38" cy="55" r="5" fill={INK} />
      <path d="M56 56 Q62 50 68 56" fill="none" {...stroke} strokeWidth={4} />
    </g>
  ),
  sleepy: () => (
    <g fill="none" {...stroke} strokeWidth={4}>
      <path d="M31 56 Q38 61 45 56" />
      <path d="M55 56 Q62 61 69 56" />
    </g>
  ),
  wide: () => (
    <g>
      <circle cx="38" cy="54" r="9" fill={PAPER} {...stroke} strokeWidth={3} />
      <circle cx="62" cy="54" r="9" fill={PAPER} {...stroke} strokeWidth={3} />
      <circle cx="40" cy="55" r="4" fill={INK} />
      <circle cx="64" cy="55" r="4" fill={INK} />
    </g>
  ),
  cyclops: () => (
    <g>
      <circle cx="50" cy="53" r="12" fill={PAPER} {...stroke} strokeWidth={3} />
      <circle cx="52" cy="54" r="5.5" fill={INK} />
    </g>
  ),
}

/* ------------------------------------------------------------------ mouth */

export const MOUTHS: Record<string, () => ReactNode> = {
  smile: () => <path d="M40 72 Q50 81 60 72" fill="none" {...stroke} strokeWidth={4} />,
  flat: () => <path d="M41 75 H59" fill="none" {...stroke} strokeWidth={4} />,
  open: () => <ellipse cx="50" cy="75" rx="6.5" ry="5.5" fill={INK} />,
  grin: () => (
    <g>
      <rect x="37" y="69" width="26" height="11" rx="3" fill={PAPER} {...stroke} strokeWidth={3} />
      <path d="M37 74.5 H63 M45.5 69 V80 M54.5 69 V80" stroke={INK} strokeWidth="2" />
    </g>
  ),
  smirk: () => <path d="M42 76 Q51 79 59 70" fill="none" {...stroke} strokeWidth={4} />,
  zigzag: () => <path d="M38 75 L43 71 L48 75 L53 71 L58 75 L62 72" fill="none" {...stroke} strokeWidth={3.5} />,
}

/* -------------------------------------------------------- top (hair / hat) */

export const TOPS: Record<string, (c: { secondary: string; hair: string }) => ReactNode> = {
  none: () => null,
  cap: ({ secondary }) => (
    <g {...stroke}>
      <path d="M20 36 Q22 12 50 12 Q78 12 80 36 Z" fill={secondary} />
      <path d="M50 30 L92 27 Q94 33 90 35 L50 37 Z" fill={secondary} />
      <circle cx="50" cy="12" r="3" fill={INK} />
    </g>
  ),
  beanie: ({ secondary }) => (
    <g {...stroke}>
      <circle cx="50" cy="9" r="6" fill={PAPER} />
      <rect x="21" y="13" width="58" height="24" rx="10" fill={secondary} />
      <rect x="19" y="29" width="62" height="9" rx="3" fill={secondary} />
      <path d="M30 29 V38 M40 29 V38 M50 29 V38 M60 29 V38 M70 29 V38" strokeWidth={2} />
    </g>
  ),
  spikes: ({ hair }) => <path d="M18 38 L24 14 L34 28 L42 6 L52 26 L62 8 L68 27 L78 12 L82 38 Z" fill={hair} {...stroke} />,
  bowl: ({ hair }) => <path d="M16 48 V36 Q16 16 50 16 Q84 16 84 36 V48 Q72 32 50 33 Q28 32 16 48 Z" fill={hair} {...stroke} />,
  antenna: ({ secondary }) => (
    <g {...stroke}>
      <path d="M50 30 L56 9" fill="none" strokeWidth={3} />
      <circle cx="56" cy="8" r="6" fill={secondary} />
    </g>
  ),
  headband: ({ secondary }) => (
    <g {...stroke}>
      <path d="M15 36 L85 30 L86 40 L16 46 Z" fill={secondary} />
      <path d="M84 33 L95 27 M85 37 L96 39" strokeWidth={3} />
    </g>
  ),
  mohawk: ({ secondary }) => <path d="M42 32 L44 4 L50 10 L56 2 L58 32 Z" fill={secondary} {...stroke} />,
  halo: () => <ellipse cx="50" cy="12" rx="22" ry="6" fill="none" stroke={HEX.amber} strokeWidth="5" />,
  crown: () => (
    <g {...stroke}>
      <path d="M24 34 L27 10 L39 22 L50 4 L61 22 L73 10 L76 34 Z" fill={HEX.amber} />
      <circle cx="50" cy="24" r="3.5" fill={HEX.vermilion} strokeWidth={2} />
    </g>
  ),
}

/* -------------------------------------------------------------- accessory */

export const ACCESSORIES: Record<string, (c: { secondary: string }) => ReactNode> = {
  none: () => null,
  glasses: () => (
    <g fill="none" {...stroke} strokeWidth={3}>
      <rect x="27" y="46" width="22" height="17" rx="4" fill={PAPER} fillOpacity={0.25} />
      <rect x="51" y="46" width="22" height="17" rx="4" fill={PAPER} fillOpacity={0.25} />
      <path d="M49 52 H51 M27 51 L18 48 M73 51 L82 48" />
    </g>
  ),
  blush: () => (
    <g fill="#ff7a8a" fillOpacity={0.75}>
      <ellipse cx="29" cy="66" rx="6" ry="3.5" />
      <ellipse cx="71" cy="66" rx="6" ry="3.5" />
    </g>
  ),
  earring: ({ secondary }) => (
    <g {...stroke} strokeWidth={2.5}>
      <path d="M84 62 V68" fill="none" />
      <path d="M84 68 L88 74 L84 80 L80 74 Z" fill={secondary} />
    </g>
  ),
  bolt: () => <path d="M70 60 L64 70 H69 L66 80 L76 67 H71 L74 60 Z" fill={HEX.amber} {...stroke} strokeWidth={2.5} />,
  freckles: () => (
    <g fill={INK} fillOpacity={0.7}>
      <circle cx="30" cy="65" r="1.6" />
      <circle cx="35" cy="68" r="1.6" />
      <circle cx="28" cy="70" r="1.6" />
      <circle cx="70" cy="65" r="1.6" />
      <circle cx="65" cy="68" r="1.6" />
      <circle cx="72" cy="70" r="1.6" />
    </g>
  ),
  bandage: () => (
    <g {...stroke} strokeWidth={2.5}>
      <rect x="62" y="62" width="17" height="8" rx="2" fill={PAPER} transform="rotate(-25 70 66)" />
      <path d="M68 63 L72 69" transform="rotate(-25 70 66)" strokeWidth={1.5} />
    </g>
  ),
  monocle: () => (
    <g fill="none" stroke={HEX.amber} strokeWidth="3">
      <circle cx="62" cy="55" r="10" />
      <path d="M71 60 Q78 74 74 86" strokeWidth="2" />
    </g>
  ),
}
