/**
 * Avatar configuration: small, serializable, deterministic.
 * Stored as jsonb in profiles.avatar_config / players.avatar_config.
 */
import { z } from 'zod'
import { isPaletteColor, type PaletteColor } from '@/lib/palette'
import { AVATAR_COLORS, PART_CATEGORIES, availableParts, findPart, type PartCategory } from './catalog'

export const AVATAR_VERSION = 1

export interface AvatarConfig {
  v: number
  /** What the default avatar was generated from (nickname, user id…). */
  seed: string
  head: string
  eyes: string
  mouth: string
  top: string
  accessory: string
  pattern: string
  primary: PaletteColor
  secondary: PaletteColor
}

/* ---------------------------------------------------------- deterministic RNG */

/** FNV-1a 32-bit hash. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: tiny, fast, good enough for picking parts. */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const normalizeSeed = (seed: string) => seed.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Same seed → same avatar, everywhere (case and extra spaces ignored, so
 * "Zoé" and " zoé " match). Only unlocked (common) parts are used.
 */
export function generateAvatarFromSeed(seed: string, unlocked?: ReadonlySet<string>): AvatarConfig {
  const next = rng(hashSeed(normalizeSeed(seed) || 'tilt'))
  const pick = (category: PartCategory, weightNone = 0) => {
    const parts = availableParts(category, unlocked)
    // Optional parts ("none") get a bias so not every avatar is overloaded.
    if (weightNone && parts.some((p) => p.id === 'none') && next() < weightNone) return 'none'
    return parts[Math.floor(next() * parts.length)]!.id
  }
  const primary = AVATAR_COLORS[Math.floor(next() * AVATAR_COLORS.length)]!
  const others = AVATAR_COLORS.filter((c) => c !== primary)
  return {
    v: AVATAR_VERSION,
    seed: seed.trim().slice(0, 64),
    head: pick('head'),
    eyes: pick('eyes'),
    mouth: pick('mouth'),
    top: pick('top', 0.2),
    accessory: pick('accessory', 0.45),
    pattern: pick('pattern', 0.35),
    primary,
    secondary: others[Math.floor(next() * others.length)]!,
  }
}

/** A brand-new random avatar (Shuffle). */
export function randomAvatar(unlocked?: ReadonlySet<string>): AvatarConfig {
  const seed = Math.random().toString(36).slice(2, 10)
  return generateAvatarFromSeed(seed, unlocked)
}

/* ------------------------------------------------------- (de)serialization */

const rawSchema = z.object({
  v: z.number().optional().catch(undefined),
  seed: z.string().optional().catch(undefined),
  head: z.string().optional().catch(undefined),
  eyes: z.string().optional().catch(undefined),
  mouth: z.string().optional().catch(undefined),
  top: z.string().optional().catch(undefined),
  accessory: z.string().optional().catch(undefined),
  pattern: z.string().optional().catch(undefined),
  primary: z.string().optional().catch(undefined),
  secondary: z.string().optional().catch(undefined),
})

/**
 * Reads a stored config (any age, any client). Unknown or missing parts fall
 * back to the avatar generated from the seed, so rendering never fails.
 * Returns null when there is nothing usable at all.
 */
export function parseAvatarConfig(raw: unknown, fallbackSeed = 'tilt'): AvatarConfig | null {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return null
  const parsed = rawSchema.safeParse(raw)
  if (!parsed.success) return null
  const r = parsed.data
  const base = generateAvatarFromSeed(r.seed ?? fallbackSeed)
  const part = (c: PartCategory, id: string | undefined) => (findPart(c, id) ? id! : base[c])
  const primary = isPaletteColor(r.primary) ? r.primary : base.primary
  const secondary = isPaletteColor(r.secondary) && r.secondary !== primary ? r.secondary : base.secondary === primary ? base.primary : base.secondary
  return {
    v: AVATAR_VERSION,
    seed: r.seed ?? base.seed,
    head: part('head', r.head),
    eyes: part('eyes', r.eyes),
    mouth: part('mouth', r.mouth),
    top: part('top', r.top),
    accessory: part('accessory', r.accessory),
    pattern: part('pattern', r.pattern),
    primary,
    secondary,
  }
}

/** Avatar for someone: their saved config, else the one derived from their name. */
export function resolveAvatar(raw: unknown, seed: string): AvatarConfig {
  return parseAvatarConfig(raw, seed) ?? generateAvatarFromSeed(seed)
}

export function serializeAvatar(config: AvatarConfig): Record<string, string | number> {
  const { v, seed, head, eyes, mouth, top, accessory, pattern, primary, secondary } = config
  return { v, seed, head, eyes, mouth, top, accessory, pattern, primary, secondary }
}

/** Cycles a part forward/backward within what the user may use. */
export function cyclePart(config: AvatarConfig, category: PartCategory, step: 1 | -1, unlocked?: ReadonlySet<string>): AvatarConfig {
  const parts = availableParts(category, unlocked)
  const index = parts.findIndex((p) => p.id === config[category])
  const next = parts[(index + step + parts.length) % parts.length]!
  return { ...config, [category]: next.id }
}

export function setColor(config: AvatarConfig, slot: 'primary' | 'secondary', color: PaletteColor): AvatarConfig {
  const other = slot === 'primary' ? 'secondary' : 'primary'
  // Never let both colors be equal: swap instead.
  return config[other] === color ? { ...config, [slot]: color, [other]: config[slot] } : { ...config, [slot]: color }
}

export { PART_CATEGORIES }
