import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { PALETTE } from '@/lib/palette'
import { AVATAR_PARTS, PART_CATEGORIES, availableParts, isUnlocked } from './catalog'
import { cyclePart, generateAvatarFromSeed, parseAvatarConfig, resolveAvatar, serializeAvatar, setColor, type AvatarConfig } from './avatar'
import { AvatarFace } from './AvatarFace'
import { ACCESSORIES, EYES, HEADS, MOUTHS, PatternDef, TOPS } from './parts'

const seeds = Array.from({ length: 400 }, (_, i) => `joueur-${i}`)

describe('generateAvatarFromSeed', () => {
  it('is deterministic and ignores case / extra spaces', () => {
    expect(generateAvatarFromSeed('Zoé')).toEqual(generateAvatarFromSeed('Zoé'))
    const { seed: _a, ...a } = generateAvatarFromSeed('  ZOÉ  ')
    const { seed: _b, ...b } = generateAvatarFromSeed('zoé')
    expect(a).toEqual(b)
  })

  it('produces varied avatars', () => {
    const keys = new Set(seeds.map((s) => {
      const c = generateAvatarFromSeed(s)
      return `${c.head}/${c.eyes}/${c.mouth}/${c.top}/${c.primary}`
    }))
    expect(keys.size).toBeGreaterThan(300)
    for (const category of ['head', 'eyes', 'mouth'] as const) {
      expect(new Set(seeds.map((s) => generateAvatarFromSeed(s)[category])).size).toBe(availableParts(category).length)
    }
  })

  it('always yields a valid config with two different colors and no locked part', () => {
    for (const s of seeds) {
      const c = generateAvatarFromSeed(s)
      expect(c.primary).not.toBe(c.secondary)
      expect(PALETTE).toContain(c.primary)
      for (const category of PART_CATEGORIES) {
        const part = AVATAR_PARTS[category].find((p) => p.id === c[category])
        expect(part, `${category}=${c[category]}`).toBeDefined()
        expect(isUnlocked(part!)).toBe(true)
      }
    }
  })

  it('can use unlocked rare parts when owned', () => {
    const unlocked = new Set(['achievement:first_win'])
    expect(availableParts('top', unlocked).map((p) => p.id)).toContain('crown')
    expect(availableParts('top').map((p) => p.id)).not.toContain('crown')
  })
})

describe('serialization', () => {
  it('round-trips through JSON', () => {
    const c = generateAvatarFromSeed('Malik')
    expect(parseAvatarConfig(JSON.parse(JSON.stringify(serializeAvatar(c))))).toEqual(c)
  })

  it('handles old, partial and hostile data', () => {
    expect(parseAvatarConfig(null)).toBeNull()
    expect(parseAvatarConfig('nope')).toBeNull()
    expect(parseAvatarConfig([1, 2])).toBeNull()
    const partial = parseAvatarConfig({ head: 'hex', eyes: 'from-the-future', primary: 'pink' }, 'Inès')!
    const fallback = generateAvatarFromSeed('Inès')
    expect(partial.head).toBe('hex')
    expect(partial.eyes).toBe(fallback.eyes)
    expect(partial.primary).toBe(fallback.primary)
    const sameColors = parseAvatarConfig({ primary: 'teal', secondary: 'teal' })!
    expect(sameColors.primary).not.toBe(sameColors.secondary)
  })

  it('resolves a default avatar for rows without config', () => {
    expect(resolveAvatar(null, 'Tom')).toEqual(generateAvatarFromSeed('Tom'))
  })
})

describe('editing helpers', () => {
  it('cycles parts with wrap-around and keeps colors distinct', () => {
    const base: AvatarConfig = { ...generateAvatarFromSeed('x'), head: availableParts('head').at(-1)!.id }
    expect(cyclePart(base, 'head', 1).head).toBe(availableParts('head')[0]!.id)
    expect(cyclePart(cyclePart(base, 'head', 1), 'head', -1).head).toBe(base.head)
    const swapped = setColor({ ...base, primary: 'teal', secondary: 'amber' }, 'primary', 'amber')
    expect(swapped).toMatchObject({ primary: 'amber', secondary: 'teal' })
  })
})

describe('rendering', () => {
  it('has a drawing for every catalog part', () => {
    const drawn: Record<string, Record<string, unknown>> = { head: HEADS, eyes: EYES, mouth: MOUTHS, top: TOPS, accessory: ACCESSORIES }
    for (const [category, table] of Object.entries(drawn)) {
      for (const part of AVATAR_PARTS[category as keyof typeof AVATAR_PARTS]) expect(table[part.id], `${category}:${part.id}`).toBeDefined()
    }
    for (const part of AVATAR_PARTS.pattern.filter((p) => p.id !== 'none')) {
      const { container } = render(<svg><PatternDef id="p" kind={part.id} color="#000" /></svg>)
      expect(container.querySelector('pattern'), part.id).not.toBeNull()
    }
  })

  it('renders many avatars without errors, with unique pattern ids', () => {
    const { container } = render(
      <div>
        {seeds.slice(0, 120).map((s) => (
          <AvatarFace key={s} config={generateAvatarFromSeed(s)} size={32} />
        ))}
        <AvatarFace config={{ ...generateAvatarFromSeed('rare'), top: 'crown', accessory: 'monocle', pattern: 'checker' }} title="Avatar de Rare" />
        <AvatarFace config={{ ...generateAvatarFromSeed('future'), head: 'unknown-head', eyes: 'unknown' }} />
      </div>,
    )
    expect(container.querySelectorAll('svg')).toHaveLength(122)
    const ids = [...container.querySelectorAll('pattern, clipPath')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(container.querySelector('[aria-label="Avatar de Rare"]')).not.toBeNull()
  })
})
