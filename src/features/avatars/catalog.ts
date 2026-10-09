/**
 * Avatar parts catalog. Drawing lives in ./parts.tsx; this file only lists
 * what exists, so the generator, the editor and validation share one source.
 *
 * Adding a part: add an entry here (unique id, lowercase) and its drawing in
 * parts.tsx under the same id. Ids are stored in the database, never rename one.
 *
 * Rarity / unlocks: parts may be `rare` or `legendary` and carry an `unlock`
 * rule. Locked parts are never generated nor offered in the editor until the
 * player owns them (`unlocked` set). Nothing grants unlocks yet: the hooks are
 * here so achievements, seasons or events can plug in later.
 */
import { PALETTE, PATTERNS, type PaletteColor } from '@/lib/palette'

export type Rarity = 'common' | 'rare' | 'legendary'

export type UnlockRule =
  | { kind: 'achievement'; id: string } // e.g. win a game, host 10 games
  | { kind: 'event'; id: string } // seasonal / special event
  | { kind: 'streak'; length: number } // answer streak during a game

export interface PartDef {
  id: string
  rarity: Rarity
  unlock?: UnlockRule
}

const common = (...ids: string[]): PartDef[] => ids.map((id) => ({ id, rarity: 'common' }))

export const AVATAR_PARTS = {
  head: common('block', 'tilt', 'pebble', 'hex', 'capsule', 'shield'),
  eyes: common('dots', 'square', 'visor', 'wink', 'sleepy', 'wide', 'cyclops'),
  mouth: common('smile', 'flat', 'open', 'grin', 'smirk', 'zigzag'),
  top: [
    ...common('none', 'cap', 'beanie', 'spikes', 'bowl', 'antenna', 'headband', 'mohawk'),
    { id: 'halo', rarity: 'rare', unlock: { kind: 'streak', length: 10 } },
    { id: 'crown', rarity: 'legendary', unlock: { kind: 'achievement', id: 'first_win' } },
  ],
  accessory: [
    ...common('none', 'glasses', 'blush', 'earring', 'bolt', 'freckles', 'bandage'),
    { id: 'monocle', rarity: 'rare', unlock: { kind: 'achievement', id: 'host_10_games' } },
  ],
  pattern: [...common('none', ...PATTERNS.filter((p) => p !== 'checker')), { id: 'checker', rarity: 'rare', unlock: { kind: 'event', id: 'launch' } }],
} satisfies Record<string, PartDef[]>

export type PartCategory = keyof typeof AVATAR_PARTS
export const PART_CATEGORIES = Object.keys(AVATAR_PARTS) as PartCategory[]

/** Avatar colors: the brand palette (each also used as players.avatar accent). */
export const AVATAR_COLORS: readonly PaletteColor[] = PALETTE

const NO_UNLOCKS: ReadonlySet<string> = new Set()

export function unlockKey(rule: UnlockRule): string {
  return rule.kind === 'streak' ? `streak:${rule.length}` : `${rule.kind}:${rule.id}`
}

export function isUnlocked(part: PartDef, unlocked: ReadonlySet<string> = NO_UNLOCKS) {
  return !part.unlock || unlocked.has(unlockKey(part.unlock))
}

export function availableParts(category: PartCategory, unlocked: ReadonlySet<string> = NO_UNLOCKS): PartDef[] {
  return AVATAR_PARTS[category].filter((p) => isUnlocked(p, unlocked))
}

export function findPart(category: PartCategory, id: string | undefined): PartDef | undefined {
  return AVATAR_PARTS[category].find((p) => p.id === id)
}
