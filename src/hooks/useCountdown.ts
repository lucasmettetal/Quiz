import { useEffect, useState } from 'react'
import { remainingMs } from '@/features/game/engine/clock'

/** Milliseconds left before a server deadline, refreshed ~5×/s. */
export function useCountdown(deadline: string | null, clockOffset: number, active = true) {
  const [left, setLeft] = useState(() => remainingMs(deadline, clockOffset))
  useEffect(() => {
    if (!active || !deadline) return
    const tick = () => setLeft(remainingMs(deadline, clockOffset))
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [deadline, clockOffset, active])
  return active && deadline ? left : 0
}
