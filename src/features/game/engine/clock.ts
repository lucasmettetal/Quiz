/**
 * Countdowns are computed against the database clock: every device may have a
 * slightly wrong clock, but deadlines come from the server.
 */

/**
 * Estimates `server - local` from a request: the server time is assumed to
 * have been read halfway through the round trip.
 */
export function estimateClockOffset(serverNow: string | number | Date, requestStartedAt: number, responseReceivedAt: number) {
  const server = new Date(serverNow).getTime()
  const midpoint = (requestStartedAt + responseReceivedAt) / 2
  return server - midpoint
}

/** Milliseconds left before `deadline` (never negative). */
export function remainingMs(deadline: string | null, offsetMs: number, localNow = Date.now()) {
  if (!deadline) return 0
  return Math.max(0, new Date(deadline).getTime() - (localNow + offsetMs))
}

/** Elapsed time since `start` on the server clock. */
export function elapsedMs(start: string, offsetMs: number, localNow = Date.now()) {
  return Math.max(0, localNow + offsetMs - new Date(start).getTime())
}
