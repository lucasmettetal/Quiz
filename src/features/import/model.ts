import type { Question } from '@/features/questions/model'
import { TIME_LIMITS, type Points } from '@/features/questions/model'

/** A quiz ready to be reviewed before it is created in the library. */
export interface ImportDraft {
  source: 'kahoot' | 'file'
  title: string
  description: string
  coverImageUrl: string | null
  questions: Question[]
  warnings: ImportWarning[]
}

export type ImportWarningCode =
  | 'unsupported_type' // e.g. puzzle, slider, word cloud, content slide
  | 'too_many_options' // more than 6 choices: extra ones dropped
  | 'image_answers' // answers that are images only (text required here)
  | 'video_dropped' // question videos are not supported yet
  | 'row_ignored' // spreadsheet row that could not be understood

export interface ImportWarning {
  code: ImportWarningCode
  /** 1-based question number (or spreadsheet row for row_ignored). */
  at: number
  detail?: string
}

/** Closest allowed time limit, in seconds. */
export function nearestTimeLimit(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 20
  return TIME_LIMITS.reduce((best, t) => (Math.abs(t - seconds) < Math.abs(best - seconds) ? t : best), TIME_LIMITS[0])
}

export function pointsFrom(value: number | null | undefined): Points {
  if (value === 0) return 0
  if (value !== null && value !== undefined && value >= 1500) return 2000
  return 1000
}

/** Removes markup and decodes the common HTML entities (Kahoot texts may contain tags). */
export function plainText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

const TRUE_WORDS = ['true', 'vrai', 'yes', 'oui', 'v', 't', '1', 'verdadero', 'wahr']
const FALSE_WORDS = ['false', 'faux', 'no', 'non', 'f', '0', 'falso', 'falsch']

export function parseBooleanWord(value: string): boolean | null {
  const v = value.trim().toLowerCase()
  if (TRUE_WORDS.includes(v)) return true
  if (FALSE_WORDS.includes(v)) return false
  return null
}
