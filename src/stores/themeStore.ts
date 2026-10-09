import { create } from 'zustand'
import { safeStorage } from '@/lib/storage'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'tilt.theme'

function readPreference(): ThemePreference {
  const v = safeStorage.get(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? systemTheme() : pref
}

function apply(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme
}

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (pref: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>((set) => {
  const preference = readPreference()
  return {
    preference,
    resolved: resolve(preference),
    setPreference: (pref) => {
      safeStorage.set(STORAGE_KEY, pref)
      const resolved = resolve(pref)
      apply(resolved)
      set({ preference: pref, resolved })
    },
  }
})

/** Applies the theme now and follows OS changes while preference is "system". */
export function initTheme() {
  apply(useThemeStore.getState().resolved)
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().preference !== 'system') return
    const resolved = systemTheme()
    apply(resolved)
    useThemeStore.setState({ resolved })
  })
}
