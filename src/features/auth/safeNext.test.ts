import { describe, expect, it, vi } from 'vitest'

vi.mock('./AuthProvider', () => ({ useAuth: () => ({}) }))
const { safeNext } = await import('./RequireCreator')

describe('safeNext', () => {
  it('keeps internal paths with their query and hash', () => {
    expect(safeNext('/app/quizzes?sort=new#top')).toBe('/app/quizzes?sort=new#top')
    expect(safeNext('/join/123456')).toBe('/join/123456')
  })

  it('refuses everything that could leave the site', () => {
    for (const next of [
      null,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/\\/evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      '/\tevil.example',
      '/\n/evil.example',
      ' /app',
    ]) {
      expect(safeNext(next), JSON.stringify(next)).toBe('/app')
    }
  })
})
