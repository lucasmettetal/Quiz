/**
 * What a player is allowed to know about a question while it is open.
 * Live: sent by SQL `get_player_view` (public_question_content).
 * Preview: derived locally with toPublicQuestion() — same shape.
 */
import { z } from 'zod'
import { isQuestionType } from './registry'
import type { Question, QuestionMedia, QuestionType } from './model'

export interface PublicContentMap {
  quiz: { options: Array<{ id: string; text: string }>; multi: boolean }
  true_false: Record<string, never>
  text: Record<string, never>
  poll: { options: Array<{ id: string; text: string }> }
}

export type PublicQuestionOf<T extends QuestionType> = {
  id: string
  type: T
  prompt: string
  media: QuestionMedia | null
  time_limit_s: number
  points: number
  content: PublicContentMap[T]
}
export type PublicQuestion = { [T in QuestionType]: PublicQuestionOf<T> }[QuestionType]

/** Correct answer as revealed after the question closes (SQL question_solution). */
export type Solution =
  | { optionIds: string[] }
  | { value: boolean }
  | { accepted: string[] }
  | Record<string, never>

export function toPublicQuestion(q: Question): PublicQuestion {
  const base = { id: q.id, prompt: q.prompt, media: q.media, time_limit_s: q.time_limit_s, points: q.points }
  switch (q.type) {
    case 'quiz':
      return {
        ...base,
        type: 'quiz',
        content: {
          options: q.content.options.map(({ id, text }) => ({ id, text })),
          multi: q.content.options.filter((o) => o.correct).length > 1,
        },
      }
    case 'poll':
      return { ...base, type: 'poll', content: { options: q.content.options.map(({ id, text }) => ({ id, text })) } }
    case 'true_false':
      return { ...base, type: 'true_false', content: {} }
    case 'text':
      return { ...base, type: 'text', content: {} }
  }
}

export function solutionOf(q: Question): Solution {
  switch (q.type) {
    case 'quiz':
      return { optionIds: q.content.options.filter((o) => o.correct).map((o) => o.id) }
    case 'true_false':
      return { value: q.content.correct }
    case 'text':
      return { accepted: q.content.accepted.filter((a) => a.trim()) }
    case 'poll':
      return {}
  }
}

const optionList = z.array(z.object({ id: z.string(), text: z.string() })).catch([])
const mediaSchema = z.object({ path: z.string(), alt: z.string().catch('') }).nullable().catch(null)

/** Parses the `question` object of get_player_view. */
export function parsePublicQuestion(raw: unknown): PublicQuestion | null {
  const base = z
    .object({ id: z.string(), type: z.string(), prompt: z.string(), media: mediaSchema, time_limit_s: z.number(), points: z.number(), content: z.unknown() })
    .safeParse(raw)
  if (!base.success || !isQuestionType(base.data.type)) return null
  const { content, ...rest } = base.data
  switch (base.data.type) {
    case 'quiz': {
      const c = z.object({ options: optionList, multi: z.boolean().catch(false) }).catch({ options: [], multi: false }).parse(content)
      return { ...rest, type: 'quiz', content: c }
    }
    case 'poll':
      return { ...rest, type: 'poll', content: z.object({ options: optionList }).catch({ options: [] }).parse(content) }
    case 'true_false':
      return { ...rest, type: 'true_false', content: {} }
    case 'text':
      return { ...rest, type: 'text', content: {} }
  }
}

export function parseSolution(raw: unknown): Solution | null {
  if (raw === null || raw === undefined) return null
  const r = z
    .union([
      z.object({ optionIds: z.array(z.string()) }),
      z.object({ value: z.boolean() }),
      z.object({ accepted: z.array(z.string()) }),
      z.object({}).strict(),
    ])
    .safeParse(raw)
  return r.success ? (r.data as Solution) : null
}
