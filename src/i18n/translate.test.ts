import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'
import { translate } from './translate'

function keysOf(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null && !('other' in v) ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('translate', () => {
  it('interpolates variables and formats numbers per locale', () => {
    expect(translate('fr', 'dashboard.greeting', { name: 'Léa' })).toBe('Salut Léa00a0!')
    expect(translate('fr', 'player.finalScore', { score: 12500 })).toBe('12 500 points')
    expect(translate('en', 'player.finalScore', { score: 12500 })).toBe('12,500 points')
  })

  it('picks plural forms', () => {
    expect(translate('fr', 'common.questions', { count: 1 })).toBe('1 question')
    expect(translate('fr', 'common.questions', { count: 0 })).toBe('0 question')
    expect(translate('en', 'common.questions', { count: 0 })).toBe('0 questions')
    expect(translate('en', 'common.questions', { count: 3 })).toBe('3 questions')
  })

  it('keeps FR and EN dictionaries in sync', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(fr).sort())
  })
})
