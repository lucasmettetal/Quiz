import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'
import { Autosaver, type SaveStatus } from './autosave'

function setup(save: () => Promise<void>) {
  const statuses: SaveStatus[] = []
  const saver = new Autosaver({ save, onStatus: (s) => statuses.push(s), debounceMs: 800, maxWaitMs: 5000, retryDelaysMs: [1000, 2000] })
  return { saver, statuses }
}

describe('Autosaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('debounces bursts of edits into a single save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { saver, statuses } = setup(save)
    for (let i = 0; i < 10; i++) {
      saver.schedule()
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(statuses.at(-1)).toBe('saved')
  })

  it('still saves during continuous typing (max wait)', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { saver } = setup(save)
    for (let i = 0; i < 60; i++) {
      saver.schedule()
      await vi.advanceTimersByTimeAsync(100)
    }
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('never overlaps saves and re-saves edits made in flight', async () => {
    let resolve!: () => void
    const save = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const { saver } = setup(save)
    saver.schedule()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    saver.schedule()
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1) // still in flight
    resolve()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('keeps changes and retries with backoff when offline', async () => {
    const save = vi.fn().mockRejectedValueOnce(new AppError('NETWORK')).mockResolvedValue(undefined)
    const { saver, statuses } = setup(save)
    saver.schedule()
    await vi.advanceTimersByTimeAsync(800)
    expect(statuses).toContain('offline')
    expect(saver.hasPendingChanges).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(statuses.at(-1)).toBe('saved')
    expect(saver.hasPendingChanges).toBe(false)
  })

  it('stops on version conflict until resumed', async () => {
    const save = vi.fn().mockRejectedValueOnce(new AppError('VERSION_CONFLICT')).mockResolvedValue(undefined)
    const { saver, statuses } = setup(save)
    saver.schedule()
    await vi.advanceTimersByTimeAsync(800)
    expect(statuses.at(-1)).toBe('conflict')
    saver.schedule()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(save).toHaveBeenCalledTimes(1)
    saver.resume()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('flush saves immediately', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { saver } = setup(save)
    saver.schedule()
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })
})
