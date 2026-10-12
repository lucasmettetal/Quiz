import { describe, expect, it } from 'vitest'
import { isAllowedExternalMedia } from './media'

describe('isAllowedExternalMedia', () => {
  it('accepts only https images from Kahoot', () => {
    expect(isAllowedExternalMedia('https://images-cdn.kahoot.it/q1.jpg')).toBe(true)
    expect(isAllowedExternalMedia('https://kahoot.it/a.png')).toBe(true)
    expect(isAllowedExternalMedia('http://images-cdn.kahoot.it/q1.jpg')).toBe(false)
    expect(isAllowedExternalMedia('https://kahoot.it.evil.example/a.png')).toBe(false)
    expect(isAllowedExternalMedia('https://tracker.example/pixel.gif')).toBe(false)
    expect(isAllowedExternalMedia('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalMedia('not a url')).toBe(false)
  })
})
