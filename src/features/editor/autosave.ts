/**
 * Autosave scheduler, independent of React.
 *
 * - debounces bursts of edits (one request after the user pauses), with a
 *   max wait so continuous typing still saves regularly;
 * - never runs two saves at once; edits made during a save trigger another;
 * - on network failure keeps the changes and retries with backoff
 *   (immediately when the browser comes back online);
 * - stops on a version conflict: the user must decide.
 */
import { toAppError, type AppError } from '@/lib/errors'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict'

export interface AutosaverOptions {
  /** Persists the latest state; resolves when the server accepted it. */
  save: () => Promise<void>
  onStatus: (status: SaveStatus, error?: AppError) => void
  debounceMs?: number
  maxWaitMs?: number
  retryDelaysMs?: number[]
}

export class Autosaver {
  private readonly opts: Required<Omit<AutosaverOptions, 'save' | 'onStatus'>> & Pick<AutosaverOptions, 'save' | 'onStatus'>
  private timer: ReturnType<typeof setTimeout> | null = null
  private firstPendingAt: number | null = null
  private inFlight: Promise<void> | null = null
  private dirty = false
  private retryIndex = 0
  private stopped = false

  constructor(options: AutosaverOptions) {
    this.opts = { debounceMs: 800, maxWaitMs: 5000, retryDelaysMs: [2000, 4000, 8000, 15000, 30000], ...options }
  }

  get hasPendingChanges() {
    return this.dirty || this.inFlight !== null
  }

  /** Call after every change. */
  schedule() {
    if (this.stopped) return
    this.dirty = true
    const now = Date.now()
    this.firstPendingAt ??= now
    this.opts.onStatus('pending')
    const waited = now - this.firstPendingAt
    const delay = Math.max(0, Math.min(this.opts.debounceMs, this.opts.maxWaitMs - waited))
    this.setTimer(delay)
  }

  /** Save right now (leaving the page, launching a game…). */
  async flush(): Promise<void> {
    if (this.stopped) return
    this.clearTimer()
    if (this.inFlight) await this.inFlight
    if (this.dirty) await this.run()
  }

  /** The network came back: retry immediately. */
  online() {
    if (this.dirty && !this.inFlight && !this.stopped) {
      this.retryIndex = 0
      this.setTimer(0)
    }
  }

  /** Resume after a conflict has been resolved by the user. */
  resume() {
    this.stopped = false
    this.retryIndex = 0
    if (this.dirty) this.setTimer(0)
  }

  dispose() {
    this.stopped = true
    this.clearTimer()
  }

  private setTimer(ms: number) {
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.run()
    }, ms)
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private async run(): Promise<void> {
    if (this.inFlight || this.stopped) return
    this.dirty = false
    this.firstPendingAt = null
    this.opts.onStatus('saving')
    this.inFlight = this.opts.save()
    try {
      await this.inFlight
      this.retryIndex = 0
      this.inFlight = null
      if (this.dirty) this.setTimer(this.opts.debounceMs)
      else this.opts.onStatus('saved')
    } catch (e) {
      this.inFlight = null
      this.dirty = true // the changes are still not on the server
      const error = toAppError(e)
      if (error.code === 'VERSION_CONFLICT') {
        this.stopped = true
        this.opts.onStatus('conflict', error)
        return
      }
      const offline = error.code === 'NETWORK' || (typeof navigator !== 'undefined' && navigator.onLine === false)
      this.opts.onStatus(offline ? 'offline' : 'error', error)
      const delays = this.opts.retryDelaysMs
      this.setTimer(delays[Math.min(this.retryIndex, delays.length - 1)]!)
      this.retryIndex++
    }
  }
}
