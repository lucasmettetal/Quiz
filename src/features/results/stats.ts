/**
 * Game statistics computed from raw rows. Pure functions: used live on the
 * host screen and afterwards in the report / CSV export.
 */
import { z } from 'zod'
import { normalizeTextAnswer } from '@/features/questions/definitions'
import { questionTypes } from '@/features/questions/registry'
import type { Question } from '@/features/questions/model'
import type { Player, PlayerAnswer } from '@/types/database'

export interface ChoiceBucket {
  key: string
  label: string
  count: number
  correct: boolean
}

const optionIdsSchema = z.object({ optionIds: z.array(z.string()) })
const valueSchema = z.object({ value: z.boolean() })
const textSchema = z.object({ text: z.string() })

/**
 * How answers spread over the possible choices. For typed answers, groups
 * identical normalized answers (most frequent first, top `limit`).
 */
export function answerDistribution(
  question: Question,
  answers: PlayerAnswer[],
  labels: { true: string; false: string } = { true: 'true', false: 'false' },
  limit = 6,
): ChoiceBucket[] {
  switch (question.type) {
    case 'quiz':
    case 'poll': {
      const counts = new Map<string, number>()
      for (const a of answers) {
        const parsed = optionIdsSchema.safeParse(a.answer)
        if (parsed.success) for (const id of parsed.data.optionIds) counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      return question.content.options.map((o) => ({
        key: o.id,
        label: o.text,
        count: counts.get(o.id) ?? 0,
        correct: 'correct' in o ? o.correct : false,
      }))
    }
    case 'true_false': {
      const count = (v: boolean) => answers.filter((a) => valueSchema.safeParse(a.answer).data?.value === v).length
      return [
        { key: 'true', label: labels.true, count: count(true), correct: question.content.correct },
        { key: 'false', label: labels.false, count: count(false), correct: !question.content.correct },
      ]
    }
    case 'text': {
      const groups = new Map<string, { label: string; count: number; correct: boolean }>()
      for (const a of answers) {
        const parsed = textSchema.safeParse(a.answer)
        if (!parsed.success) continue
        const key = normalizeTextAnswer(parsed.data.text, question.content.caseSensitive)
        const g = groups.get(key) ?? { label: parsed.data.text.trim(), count: 0, correct: a.is_correct === true }
        g.count++
        groups.set(key, g)
      }
      return [...groups.entries()]
        .map(([key, g]) => ({ key, ...g }))
        .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label))
        .slice(0, limit)
    }
  }
}

export interface QuestionStats {
  questionId: string
  position: number
  graded: boolean
  answered: number
  correct: number
  /** correct / players expected to answer; null for ungraded questions */
  accuracy: number | null
  avgElapsedMs: number | null
  mostChosen: ChoiceBucket | null
}

export function questionStats(
  question: Question & { position: number },
  answers: PlayerAnswer[],
  playerCount: number,
): QuestionStats {
  const mine = answers.filter((a) => a.game_question_id === question.id)
  const graded = questionTypes[question.type].graded
  const correct = mine.filter((a) => a.is_correct === true).length
  const distribution = answerDistribution(question, mine)
  const mostChosen = distribution.reduce<ChoiceBucket | null>((best, b) => (b.count > (best?.count ?? 0) ? b : best), null)
  return {
    questionId: question.id,
    position: question.position,
    graded,
    answered: mine.length,
    correct,
    accuracy: graded && playerCount > 0 ? correct / playerCount : null,
    avgElapsedMs: mine.length ? Math.round(mine.reduce((s, a) => s + a.elapsed_ms, 0) / mine.length) : null,
    mostChosen,
  }
}

export interface GameReport {
  playerCount: number
  questions: QuestionStats[]
  /** Average accuracy over graded questions (null if none). */
  accuracy: number | null
  avgScore: number
  avgElapsedMs: number | null
  /** Graded questions, lowest accuracy first. */
  hardest: QuestionStats[]
}

export function buildReport(questions: Array<Question & { position: number }>, players: Player[], answers: PlayerAnswer[]): GameReport {
  const participants = players.filter((p) => p.status !== 'kicked')
  const playerCount = participants.length
  const stats = questions.map((q) => questionStats(q, answers, playerCount))
  const graded = stats.filter((s) => s.accuracy !== null)
  const accuracy = graded.length ? graded.reduce((s, q) => s + q.accuracy!, 0) / graded.length : null
  const timed = answers.filter((a) => a.elapsed_ms >= 0)
  return {
    playerCount,
    questions: stats,
    accuracy,
    avgScore: playerCount ? Math.round(participants.reduce((s, p) => s + p.score, 0) / playerCount) : 0,
    avgElapsedMs: timed.length ? Math.round(timed.reduce((s, a) => s + a.elapsed_ms, 0) / timed.length) : null,
    hardest: [...graded].sort((a, b) => a.accuracy! - b.accuracy! || a.position - b.position).slice(0, 3),
  }
}

/* ------------------------------------------------------------------ CSV */

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  // Quote when needed; neutralize spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  // BOM so Excel opens UTF-8 accents correctly.
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

/** One row per player: rank, nickname, score, correct answers, then per-question points. */
export function playersCsv(
  questions: Array<Question & { position: number }>,
  players: Player[],
  answers: PlayerAnswer[],
  headers: { rank: string; player: string; score: string; correct: string; question: (n: number) => string },
): string {
  const byKey = new Map(answers.map((a) => [`${a.player_id}:${a.game_question_id}`, a]))
  const ranked = players
    .filter((p) => p.status !== 'kicked')
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.score - a.score)
  const header = [headers.rank, headers.player, headers.score, headers.correct, ...questions.map((q) => headers.question(q.position + 1))]
  const rows = ranked.map((p) => [
    p.rank,
    p.nickname,
    p.score,
    p.correct_count,
    ...questions.map((q) => {
      const a = byKey.get(`${p.id}:${q.id}`)
      return a ? a.points : ''
    }),
  ])
  return toCsv([header, ...rows])
}
