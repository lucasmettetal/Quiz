/**
 * Question model shared by the editor, previews and the live game.
 *
 * Adding a question type:
 *   1. add its content/answer shapes to ContentMap / AnswerMap
 *   2. write its definition in ./definitions and register it in ./registry
 *   3. register its UI in ./ui/registry
 *   4. teach the SQL functions (question_issues, evaluate_answer, …) about it
 *      in a new migration, and extend the `questions.type` check constraint.
 */
import type { z } from 'zod'

export interface ChoiceOption {
  id: string
  text: string
  correct: boolean
}

export interface PollOption {
  id: string
  text: string
}

export interface ContentMap {
  quiz: { options: ChoiceOption[] }
  true_false: { correct: boolean }
  text: { accepted: string[]; caseSensitive: boolean }
  poll: { options: PollOption[] }
}

export interface AnswerMap {
  quiz: { optionIds: string[] }
  true_false: { value: boolean }
  text: { text: string }
  poll: { optionIds: string[] }
}

export type QuestionType = keyof ContentMap
export const QUESTION_TYPES = ['quiz', 'true_false', 'text', 'poll'] as const satisfies readonly QuestionType[]

export const POINT_VALUES = [0, 1000, 2000] as const
export type Points = (typeof POINT_VALUES)[number]

export const TIME_LIMITS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 240] as const

export interface QuestionMedia {
  path: string
  alt: string
}

interface QuestionBase {
  id: string
  prompt: string
  media: QuestionMedia | null
  time_limit_s: number
  points: Points
}

export type QuestionOf<T extends QuestionType> = QuestionBase & { type: T; content: ContentMap[T] }
export type Question = { [T in QuestionType]: QuestionOf<T> }[QuestionType]
export type AnyAnswer = AnswerMap[QuestionType]

/** Codes shared with SQL `public.question_issues`. */
export type QuestionIssue = 'prompt_empty' | 'options_count' | 'option_empty' | 'no_correct' | 'accepted_empty' | 'unknown_type'

export interface QuestionTypeDefinition<T extends QuestionType> {
  type: T
  category: 'test' | 'collect'
  /** Ungraded types (poll) never give points nor break streaks. */
  graded: boolean
  defaults: { time_limit_s: number; points: Points }
  contentSchema: z.ZodType<ContentMap[T]>
  answerSchema: z.ZodType<AnswerMap[T]>
  createContent(): ContentMap[T]
  /** Type-specific problems (the prompt is checked by the caller). */
  validate(content: ContentMap[T]): QuestionIssue[]
  /** Mirrors SQL `public.evaluate_answer`. null = not graded. */
  evaluate(content: ContentMap[T], answer: AnswerMap[T]): boolean | null
  /** Content for this type built from another question, keeping what fits. */
  convertFrom(question: Question): ContentMap[T]
}

export function newOptionId() {
  return crypto.randomUUID().slice(0, 8)
}
