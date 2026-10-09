import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { safeStorage } from '@/lib/storage'
import { GAME_STATES } from '@/features/game/engine/stateMachine'
import { parsePublicQuestion, parseSolution, type PublicQuestion, type Solution } from '@/features/questions/public'
import type { AnyAnswer } from '@/features/questions/model'
import { PALETTE, type PaletteColor } from '@/lib/palette'
import { PLAYER_STATUSES, playerSchema, type Player } from '@/types/database'

const foundSessionSchema = z
  .object({
    session_id: z.string(),
    quiz_title: z.string(),
    state: z.enum(GAME_STATES),
    reason: z.string().nullable(),
  })
  .nullable()
export type FoundSession = NonNullable<z.infer<typeof foundSessionSchema>>

/** Looks a PIN up without needing an identity (null = no such running game). */
export async function findSession(pin: string): Promise<FoundSession | null> {
  const { data, error } = await getSupabase().rpc('find_session', { p_pin: pin })
  if (error) throw toAppError(error)
  return foundSessionSchema.parse(data)
}

export async function joinSession(pin: string, nickname: string, avatar: PaletteColor): Promise<Player> {
  const { data, error } = await getSupabase().rpc('join_session', { p_pin: pin, p_nickname: nickname, p_avatar: avatar }).single()
  if (error) throw toAppError(error)
  const player = playerSchema.parse(data)
  rememberPlayer(player.session_id, pin)
  return player
}

export async function leaveSession(sessionId: string) {
  const { error } = await getSupabase().rpc('leave_session', { p_session_id: sessionId })
  if (error) throw toAppError(error)
  forgetPlayer(sessionId)
}

export async function submitAnswer(sessionId: string, gameQuestionId: string, answer: AnyAnswer) {
  const { error } = await getSupabase().rpc('submit_answer', {
    p_session_id: sessionId,
    p_game_question_id: gameQuestionId,
    p_answer: answer,
  })
  if (error) throw toAppError(error)
}

export async function getServerTime(): Promise<{ serverNow: string; startedAt: number; receivedAt: number }> {
  const startedAt = Date.now()
  const { data, error } = await getSupabase().rpc('server_time')
  if (error) throw toAppError(error)
  return { serverNow: z.string().parse(data), startedAt, receivedAt: Date.now() }
}

/* ----------------------------------------------------------- player view */

const viewSchema = z.object({
  server_now: z.string(),
  session: z.object({
    id: z.string(),
    state: z.enum(GAME_STATES),
    quiz_title: z.string(),
    pin: z.string(),
    current_index: z.number(),
    question_count: z.number(),
    phase_started_at: z.string(),
    question_deadline: z.string().nullable(),
  }),
  player: z.object({
    id: z.string(),
    nickname: z.string(),
    avatar: z.enum(PALETTE),
    status: z.enum(PLAYER_STATUSES),
    score: z.number(),
    last_points: z.number(),
    rank: z.number().nullable(),
    previous_rank: z.number().nullable(),
    streak: z.number(),
    correct_count: z.number(),
  }),
  player_count: z.number(),
  question: z.unknown().nullable(),
  answer: z
    .object({ answer: z.unknown(), is_correct: z.boolean().nullable(), points: z.number().nullable() })
    .nullable(),
})

export type PlayerView = Omit<z.infer<typeof viewSchema>, 'question'> & {
  question: (PublicQuestion & { solution: Solution | null }) | null
  /** server - local clock, in ms */
  clockOffset: number
}

export async function getPlayerView(sessionId: string): Promise<PlayerView> {
  const startedAt = Date.now()
  const { data, error } = await getSupabase().rpc('get_player_view', { p_session_id: sessionId })
  if (error) throw toAppError(error)
  const receivedAt = Date.now()
  const raw = viewSchema.parse(data)
  const question = raw.question ? parsePublicQuestion(raw.question) : null
  const solution = raw.question && typeof raw.question === 'object' && 'solution' in raw.question ? parseSolution(raw.question.solution) : null
  const server = new Date(raw.server_now).getTime()
  return {
    ...raw,
    question: question ? { ...question, solution } : null,
    clockOffset: server - (startedAt + receivedAt) / 2,
  }
}

/* ------------------------------------------- remember games on this device */

const KEY = 'tilt.games'

function readGames(): Record<string, { pin: string; at: number }> {
  try {
    return JSON.parse(safeStorage.get(KEY) ?? '{}') as Record<string, { pin: string; at: number }>
  } catch {
    return {}
  }
}

function rememberPlayer(sessionId: string, pin: string) {
  const games = readGames()
  games[sessionId] = { pin, at: Date.now() }
  // keep the 10 most recent
  const recent = Object.entries(games).sort((a, b) => b[1].at - a[1].at).slice(0, 10)
  safeStorage.set(KEY, JSON.stringify(Object.fromEntries(recent)))
}

export function forgetPlayer(sessionId: string) {
  const games = readGames()
  delete games[sessionId]
  safeStorage.set(KEY, JSON.stringify(games))
}
