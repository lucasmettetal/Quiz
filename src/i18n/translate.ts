import { en } from './en'
import { fr, type Messages } from './fr'

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const dictionaries: Record<Locale, Messages> = { fr, en }

type Plural = { one: string; other: string }
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Paths<T[K], `${P}${K}.`>
}[keyof T & string]

export type MessageKey = Paths<Messages>
export type TranslateVars = Record<string, string | number>
export type TFunction = (key: MessageKey, vars?: TranslateVars) => string

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

function lookup(dict: Messages, key: string): unknown {
  let node: unknown = dict
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return node
}

function isPlural(value: unknown): value is Plural {
  return typeof value === 'object' && value !== null && 'other' in value && 'one' in value
}

function formatVar(locale: Locale, v: string | number) {
  return typeof v === 'number' ? new Intl.NumberFormat(locale).format(v) : v
}

export function translate(locale: Locale, key: MessageKey, vars?: TranslateVars): string {
  let value = lookup(dictionaries[locale], key)
  if (value === undefined && locale !== 'fr') value = lookup(fr, key)
  if (isPlural(value)) {
    const count = Number(vars?.count ?? 0)
    value = new Intl.PluralRules(locale).select(count) === 'one' ? value.one : value.other
  }
  if (typeof value !== 'string') return key
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = vars[name]
    return v === undefined ? match : formatVar(locale, v)
  })
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'fr'
  return navigator.language?.slice(0, 2) === 'en' ? 'en' : 'fr'
}
