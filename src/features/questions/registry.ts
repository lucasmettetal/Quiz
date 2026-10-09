import { z } from 'zod'
import { pollDefinition, quizDefinition, textDefinition, trueFalseDefinition } from './definitions'
import {
  POINT_VALUES,
  QUESTION_TYPES,
  type AnswerMap,
  type ContentMap,
  type Points,
  type Question,
  type QuestionIssue,
  type QuestionMedia,
  type QuestionOf,
  type QuestionType,
  type QuestionTypeDefinition,
} from './model'

type Registry = { [T in QuestionType]: QuestionTypeDefinition<T> }

export const questionTypes: Registry = {
  quiz: quizDefinition,
  true_false: trueFalseDefinition,
  text: textDefinition,
  poll: pollDefinition,
}

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as readonly string[]).includes(value)
}

/**
 * TypeScript cannot correlate `questionTypes[q.type]` with `q.content` for a
 * union, so this is the single place where that link is asserted.
 */
function definitionOf<T extends QuestionType>(q: QuestionOf<T>): QuestionTypeDefinition<T> {
  return questionTypes[q.type] as unknown as QuestionTypeDefinition<T>
}

export function questionIssues(q: Question): QuestionIssue[] {
  const issues: QuestionIssue[] = q.prompt.trim() ? [] : ['prompt_empty']
  return [...issues, ...definitionOf(q).validate(q.content as never)]
}

export function isQuestionValid(q: Question) {
  return questionIssues(q).length === 0
}

export function evaluateAnswer<T extends QuestionType>(q: QuestionOf<T>, answer: AnswerMap[T]): boolean | null {
  return definitionOf(q).evaluate(q.content, answer)
}

export function createQuestion(type: QuestionType): Question {
  const def = questionTypes[type]
  return {
    id: crypto.randomUUID(),
    type,
    prompt: '',
    media: null,
    time_limit_s: def.defaults.time_limit_s,
    points: def.defaults.points,
    content: def.createContent(),
  } as Question
}

/** Switch a question to another type, keeping prompt, media, timing and compatible answers. */
export function convertQuestion(q: Question, type: QuestionType): Question {
  if (q.type === type) return q
  const def = questionTypes[type]
  const points = def.graded ? (q.points === 0 ? def.defaults.points : q.points) : 0
  return { ...q, type, points, content: def.convertFrom(q) } as Question
}

export function duplicateQuestion(q: Question): Question {
  return { ...structuredClone(q), id: crypto.randomUUID() }
}

const mediaSchema = z.object({ path: z.string().min(1), alt: z.string().catch('') })

function asPoints(v: number): Points {
  return (POINT_VALUES as readonly number[]).includes(v) ? (v as Points) : 1000
}

/** Builds a typed question from a DB row (questions or game_questions), tolerating old/partial content. */
export function questionFromRow(row: {
  id: string
  type: string
  prompt: string
  media: unknown
  time_limit_s: number
  points: number
  content: unknown
}): Question | null {
  if (!isQuestionType(row.type)) return null
  const def = questionTypes[row.type]
  const parsed = def.contentSchema.safeParse(row.content)
  const media = mediaSchema.safeParse(row.media)
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    media: media.success ? (media.data as QuestionMedia) : null,
    time_limit_s: row.time_limit_s,
    points: asPoints(row.points),
    content: (parsed.success ? parsed.data : def.createContent()) as ContentMap[typeof row.type],
  } as Question
}

/** Payload for `public.save_quiz`. */
export function questionToPayload(q: Question) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    media: q.media,
    time_limit_s: q.time_limit_s,
    points: q.points,
    content: q.content,
  }
}
