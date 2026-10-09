/**
 * Spreadsheet import (CSV or XLSX, already read into rows of strings).
 *
 * Understands Tilt's own template and Kahoot's spreadsheet template
 * ("Question – max 120 characters", "Answer 1…4", "Time limit (sec)",
 * "Correct answer(s)"), in French or English, by matching header names.
 */
import { MAX_OPTIONS } from '@/features/questions/definitions'
import { newOptionId, type Question, type QuestionType } from '@/features/questions/model'
import { nearestTimeLimit, parseBooleanWord, plainText, pointsFrom, type ImportDraft, type ImportWarning } from './model'

/** RFC 4180 CSV with delimiter auto-detection (`,` `;` or tab). */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // drop UTF-8 BOM
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

interface Columns {
  question: number
  type?: number
  answers: number[]
  correct?: number
  time?: number
  points?: number
}

function detectColumns(header: string[]): Columns | null {
  const cols: Partial<Omit<Columns, 'answers'>> = {}
  const answerCols: Array<[number, number]> = []
  header.forEach((raw, i) => {
    const h = norm(raw)
    if (!h) return
    const answer = h.match(/^(answer|reponse|choix|choice|option)\s*(\d)/)
    if (answer) answerCols.push([Number(answer[2]), i])
    else if (/correct|bonne|right|solution/.test(h)) cols.correct ??= i
    else if (/^(question|enonce|intitule)/.test(h)) cols.question ??= i
    else if (/^type/.test(h)) cols.type ??= i
    else if (/time|temps|duree|limit|chrono/.test(h)) cols.time ??= i
    else if (/^points?\b/.test(h)) cols.points ??= i
  })
  if (cols.question === undefined || (answerCols.length === 0 && cols.correct === undefined)) return null
  return {
    question: cols.question,
    type: cols.type,
    correct: cols.correct,
    time: cols.time,
    points: cols.points,
    answers: answerCols.sort((a, b) => a[0] - b[0]).map(([, i]) => i).slice(0, MAX_OPTIONS),
  }
}

function typeFrom(value: string): QuestionType | null {
  const v = norm(value).replace(/[\s_/-]+/g, '')
  if (!v) return null
  if (['quiz', 'qcm', 'mcq', 'choix', 'multiplechoice'].includes(v)) return 'quiz'
  if (['vf', 'vraifaux', 'truefalse', 'tf', 'vraioufaux', 'trueorfalse'].includes(v)) return 'true_false'
  if (['text', 'texte', 'reponseecrite', 'typeanswer', 'open', 'openended', 'ecrite'].includes(v)) return 'text'
  if (['poll', 'sondage', 'survey', 'vote'].includes(v)) return 'poll'
  return null
}

/** "1,3" / "A C" / "2" → zero-based indexes. */
function correctIndexes(value: string, count: number): number[] {
  return [
    ...new Set(
      value
        .split(/[\s,;|/]+/)
        .map((token) => {
          const t = token.trim().toUpperCase()
          if (/^[1-9]$/.test(t)) return Number(t) - 1
          if (/^[A-F]$/.test(t)) return t.charCodeAt(0) - 65
          return -1
        })
        .filter((i) => i >= 0 && i < count),
    ),
  ]
}

function pointsCell(value: string | undefined) {
  const v = norm(value ?? '')
  if (!v) return 1000
  if (['0', 'aucun', 'none', 'non'].includes(v)) return 0
  if (['double', '2000', '2x', 'x2'].includes(v)) return 2000
  const n = Number(v)
  return Number.isFinite(n) ? n : 1000
}

export function tableToDraft(rows: string[][], fileName: string): ImportDraft {
  const headerIndex = rows.slice(0, 25).findIndex((r) => detectColumns(r) !== null)
  if (headerIndex === -1) throw new Error('IMPORT_FILE_INVALID')
  const cols = detectColumns(rows[headerIndex]!)!
  const warnings: ImportWarning[] = []
  const questions: Question[] = []
  const cell = (r: string[], i: number | undefined) => (i === undefined ? '' : (r[i] ?? '').trim())

  rows.slice(headerIndex + 1).forEach((r, offset) => {
    const rowNumber = headerIndex + offset + 2
    const prompt = plainText(cell(r, cols.question), 500)
    const answers = cols.answers.map((i) => plainText(cell(r, i), 120)).filter((a, i, all) => a || all.slice(i + 1).some(Boolean))
    const correct = cell(r, cols.correct)
    if (!prompt && answers.every((a) => !a)) return // blank line
    let type = typeFrom(cell(r, cols.type))
    if (!type) {
      if (answers.filter(Boolean).length >= 2) type = 'quiz'
      else if (correct) type = parseBooleanWord(correct) !== null && answers.length === 0 ? 'true_false' : 'text'
      else {
        warnings.push({ code: 'row_ignored', at: rowNumber })
        return
      }
    }
    const base = {
      id: crypto.randomUUID(),
      prompt,
      media: null,
      time_limit_s: nearestTimeLimit(Number(cell(r, cols.time).replace(',', '.')) || 20),
    }
    const points = pointsFrom(pointsCell(cell(r, cols.points)))
    switch (type) {
      case 'quiz': {
        const indexes = correctIndexes(correct, answers.length)
        questions.push({ ...base, type, points, content: { options: answers.map((text, i) => ({ id: newOptionId(), text, correct: indexes.includes(i) })) } })
        break
      }
      case 'poll':
        questions.push({ ...base, type, points: 0, content: { options: answers.map((text) => ({ id: newOptionId(), text })) } })
        break
      case 'true_false': {
        // Either a word ("vrai") or an index pointing at answer 1/2.
        const word = parseBooleanWord(correct)
        const index = correctIndexes(correct, Math.max(2, answers.length))[0]
        const value = word ?? (index !== undefined && answers[index] ? (parseBooleanWord(answers[index]!) ?? index === 0) : true)
        questions.push({ ...base, type, points, content: { correct: value } })
        break
      }
      case 'text': {
        const accepted = [...answers.filter(Boolean), ...correct.split('|').map((s) => s.trim()).filter((s) => s && !/^[\d,\s]+$/.test(s))]
        questions.push({ ...base, type, points, content: { accepted: accepted.length ? [...new Set(accepted)] : [''], caseSensitive: false } })
        break
      }
    }
  })

  return {
    source: 'file',
    title: plainText(fileName.replace(/\.(csv|xlsx|tsv|txt)$/i, '').replace(/[_-]+/g, ' '), 120),
    description: '',
    coverImageUrl: null,
    questions,
    warnings,
  }
}

/** Tilt's import template (header + one example per type), in the UI language. */
export function templateRows(labels: {
  type: string
  question: string
  answer: (n: number) => string
  correct: string
  time: string
  points: string
  examples: string[][]
}): string[][] {
  return [
    [labels.type, labels.question, ...Array.from({ length: MAX_OPTIONS }, (_, i) => labels.answer(i + 1)), labels.correct, labels.time, labels.points],
    ...labels.examples,
  ]
}
