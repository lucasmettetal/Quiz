/**
 * Row schemas for the Supabase tables. Every service parses what it receives
 * with these, so a schema drift fails loudly at the boundary instead of deep
 * inside a component — and no `any` leaks from the untyped client.
 */
import { z } from 'zod'
import { GAME_STATES } from '@/features/game/engine/stateMachine'
import { PALETTE, PATTERNS } from '@/lib/palette'

export const QUIZ_CATEGORIES = [
  'general', 'science', 'math', 'history', 'geography', 'languages',
  'arts', 'sport', 'tech', 'business', 'culture', 'other',
] as const
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number]

export const QUIZ_LANGUAGES = ['fr', 'en', 'es', 'de', 'it', 'pt'] as const
export type QuizLanguage = (typeof QUIZ_LANGUAGES)[number]

export const VISIBILITIES = ['private', 'unlisted', 'public'] as const
export type Visibility = (typeof VISIBILITIES)[number]

const timestamp = z.string()
const nullableTimestamp = z.string().nullable()

export const profileSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  avatar_color: z.enum(PALETTE),
  locale: z.enum(['fr', 'en']),
  created_at: timestamp,
  updated_at: timestamp,
})
export type Profile = z.infer<typeof profileSchema>

export const quizSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  title: z.string(),
  description: z.string(),
  language: z.string(),
  category: z.enum(QUIZ_CATEGORIES),
  cover_color: z.enum(PALETTE),
  cover_pattern: z.enum(PATTERNS),
  cover_image_path: z.string().nullable(),
  visibility: z.enum(VISIBILITIES),
  status: z.enum(['draft', 'published']),
  forked_from: z.string().nullable(),
  question_count: z.number(),
  play_count: z.number(),
  version: z.number(),
  published_at: nullableTimestamp,
  created_at: timestamp,
  updated_at: timestamp,
})
export type Quiz = z.infer<typeof quizSchema>

export const questionRowSchema = z.object({
  id: z.string(),
  quiz_id: z.string(),
  position: z.number(),
  type: z.string(),
  prompt: z.string(),
  media: z.unknown().nullable(),
  time_limit_s: z.number(),
  points: z.number(),
  content: z.unknown(),
})
export type QuestionRow = z.infer<typeof questionRowSchema>

export const gameSessionSchema = z.object({
  id: z.string(),
  quiz_id: z.string().nullable(),
  host_id: z.string(),
  quiz_title: z.string(),
  pin: z.string(),
  state: z.enum(GAME_STATES),
  current_index: z.number(),
  question_count: z.number(),
  phase_started_at: timestamp,
  question_deadline: nullableTimestamp,
  max_players: z.number(),
  allow_late_join: z.boolean(),
  locked: z.boolean(),
  started_at: nullableTimestamp,
  ended_at: nullableTimestamp,
  created_at: timestamp,
})
export type GameSession = z.infer<typeof gameSessionSchema>

export const gameQuestionSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  position: z.number(),
  source_question_id: z.string().nullable(),
  type: z.string(),
  prompt: z.string(),
  media: z.unknown().nullable(),
  time_limit_s: z.number(),
  points: z.number(),
  content: z.unknown(),
})
export type GameQuestionRow = z.infer<typeof gameQuestionSchema>

export const PLAYER_STATUSES = ['active', 'left', 'kicked'] as const
export type PlayerStatus = (typeof PLAYER_STATUSES)[number]

export const playerSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  user_id: z.string(),
  nickname: z.string(),
  avatar: z.enum(PALETTE),
  status: z.enum(PLAYER_STATUSES),
  score: z.number(),
  last_points: z.number(),
  rank: z.number().nullable(),
  previous_rank: z.number().nullable(),
  streak: z.number(),
  correct_count: z.number(),
  joined_at: timestamp,
})
export type Player = z.infer<typeof playerSchema>

export const playerAnswerSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  game_question_id: z.string(),
  player_id: z.string(),
  answer: z.unknown(),
  is_correct: z.boolean().nullable(),
  points: z.number(),
  elapsed_ms: z.number(),
  submitted_at: timestamp,
})
export type PlayerAnswer = z.infer<typeof playerAnswerSchema>
