import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { safeStorage } from '@/lib/storage'
import { detectLocale, isLocale, translate, type Locale, type TFunction } from './translate'

const STORAGE_KEY = 'tilt.locale'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TFunction
}

const I18nContext = createContext<I18nContextValue | null>(null)

function initialLocale(): Locale {
  const stored = safeStorage.get(STORAGE_KEY)
  return isLocale(stored) ? stored : detectLocale()
}

export function I18nProvider({ children, locale: forced }: { children: ReactNode; locale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => forced ?? initialLocale())

  const setLocale = useCallback((next: Locale) => {
    safeStorage.set(STORAGE_KEY, next)
    setLocaleState(next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextValue {
  const ctx = use(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT(): TFunction {
  return useI18n().t
}
