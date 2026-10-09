import { useCallback, useState } from 'react'
import { safeStorage } from '@/lib/storage'

/** useState mirrored in localStorage, for small UI preferences (view mode, filters). */
export function usePersistentState<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    const stored = safeStorage.get(key)
    return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : initial
  })
  const update = useCallback(
    (next: T) => {
      safeStorage.set(key, next)
      setValue(next)
    },
    [key],
  )
  return [value, update] as const
}
