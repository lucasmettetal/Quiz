/**
 * Brand color & pattern system. Tailwind only ships classes it can see, so
 * every class is spelled out here rather than built from strings.
 */
export const PALETTE = ['vermilion', 'cobalt', 'lime', 'amber', 'teal', 'orchid'] as const
export type PaletteColor = (typeof PALETTE)[number]

export const PATTERNS = ['stripes', 'dots', 'grid', 'waves', 'zigzag', 'checker'] as const
export type PatternName = (typeof PATTERNS)[number]

interface ColorClasses {
  /** solid background */
  bg: string
  /** darker shade, for pressed states / pattern overlays */
  deep: string
  /** readable foreground on `bg` */
  on: string
  /** the color used as text on neutral surfaces */
  text: string
  /** pattern ink (used with `pattern-*`, paints with currentColor) */
  patternInk: string
}

export const COLOR_CLASSES: Record<PaletteColor, ColorClasses> = {
  vermilion: { bg: 'bg-vermilion', deep: 'bg-vermilion-deep', on: 'text-white', text: 'text-vermilion', patternInk: 'text-vermilion-deep' },
  cobalt: { bg: 'bg-cobalt', deep: 'bg-cobalt-deep', on: 'text-white', text: 'text-cobalt', patternInk: 'text-cobalt-deep' },
  lime: { bg: 'bg-lime', deep: 'bg-lime-deep', on: 'text-ink', text: 'text-lime-deep', patternInk: 'text-lime-deep' },
  amber: { bg: 'bg-amber', deep: 'bg-amber-deep', on: 'text-ink', text: 'text-warning-ink', patternInk: 'text-amber-deep' },
  teal: { bg: 'bg-teal', deep: 'bg-teal-deep', on: 'text-white', text: 'text-teal', patternInk: 'text-teal-deep' },
  orchid: { bg: 'bg-orchid', deep: 'bg-orchid-deep', on: 'text-white', text: 'text-orchid', patternInk: 'text-orchid-deep' },
}

export const PATTERN_CLASSES: Record<PatternName, string> = {
  stripes: 'pattern-stripes',
  dots: 'pattern-dots',
  grid: 'pattern-grid',
  waves: 'pattern-waves',
  zigzag: 'pattern-zigzag',
  checker: 'pattern-checker',
}

/**
 * Answer identity: each slot couples a color, a pattern and a letter, so an
 * answer is never identified by color alone (color-blind friendly, and it
 * works on a black & white projector).
 */
export interface AnswerSlot {
  color: PaletteColor
  pattern: PatternName
  letter: string
}

export const ANSWER_SLOTS: readonly AnswerSlot[] = [
  { color: 'vermilion', pattern: 'stripes', letter: 'A' },
  { color: 'cobalt', pattern: 'dots', letter: 'B' },
  { color: 'amber', pattern: 'zigzag', letter: 'C' },
  { color: 'teal', pattern: 'waves', letter: 'D' },
  { color: 'orchid', pattern: 'grid', letter: 'E' },
  { color: 'lime', pattern: 'checker', letter: 'F' },
]

export function answerSlot(index: number): AnswerSlot {
  return ANSWER_SLOTS[index % ANSWER_SLOTS.length]!
}

export function isPaletteColor(v: unknown): v is PaletteColor {
  return typeof v === 'string' && (PALETTE as readonly string[]).includes(v)
}

export function isPatternName(v: unknown): v is PatternName {
  return typeof v === 'string' && (PATTERNS as readonly string[]).includes(v)
}

/** Deterministic color for things without one (e.g. a player name). */
export function colorFor(seed: string): PaletteColor {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}
