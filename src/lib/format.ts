import type { Locale } from '@/i18n/translate'

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "il y a 3 heures" / "3 hours ago". Returns null under a minute (caller shows "just now"). */
export function formatRelative(date: string | Date, locale: Locale, now = Date.now()): string | null {
  const seconds = (new Date(date).getTime() - now) / 1000
  const abs = Math.abs(seconds)
  if (abs < 60) return null
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return null
}

export function formatDate(date: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

export function formatNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(locale).format(n)
}

export function formatPercent(ratio: number, locale: Locale) {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
}

/** "123456" → "123 456" for display. */
export function formatPin(pin: string) {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin
}
