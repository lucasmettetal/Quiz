import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { toAppError, unwrap } from '@/lib/errors'
import {
  gameQuestionSchema,
  gameSessionSchema,
  playerAnswerSchema,
  playerSchema,
  type GameSession,
  type Player,
} from '@/types/database'

/* ------------------------------------------------------------------ host */

export async function createGameSession(quizId: string, options: { maxPlayers?: number; allowLateJoin?: boolean } = {}) {
  const { data, error } = await getSupabase()
    .rpc('create_game_session', {
      p_quiz_id: quizId,
      p_options: { max_players: options.maxPlayers, allow_late_join: options.allowLateJoin },
    })
    .single()
  if (error) throw toAppError(error)
  return gameSessionSchema.parse(data)
}

export async function getSession(sessionId: string): Promise<GameSession> {
  const { data, error } = await getSupabase().from('game_sessions').select('*').eq('id', sessionId).maybeSingle()
  if (error) throw toAppError(error)
  if (!data) throw toAppError(new Error('NOT_FOUND'))
  return gameSessionSchema.parse(data)
}

export async function getSessionQuestions(sessionId: string) {
  const rows = unwrap(await getSupabase().from('game_questions').select('*').eq('session_id', sessionId).order('position'))
  return z.array(gameQuestionSchema).parse(rows)
}

export async function getSessionPlayers(sessionId: string): Promise<Player[]> {
  const rows = unwrap(await getSupabase().from('players').select('*').eq('session_id', sessionId).order('joined_at'))
  return z.array(playerSchema).parse(rows)
}

export async function getSessionAnswers(sessionId: string, gameQuestionId?: string) {
  let query = getSupabase().from('player_answers').select('*').eq('session_id', sessionId)
  if (gameQuestionId) query = query.eq('game_question_id', gameQuestionId)
  return z.array(playerAnswerSchema).parse(unwrap(await query))
}

/** Asks the server to move on from `fromState`. Idempotent server-side. */
export async function hostAdvance(sessionId: string, fromState: GameSession['state']) {
  const { data, error } = await getSupabase().rpc('host_advance', { p_session_id: sessionId, p_from_state: fromState }).single()
  if (error) throw toAppError(error)
  return gameSessionSchema.parse(data)
}

export async function hostEndGame(sessionId: string) {
  const { error } = await getSupabase().rpc('host_end_game', { p_session_id: sessionId })
  if (error) throw toAppError(error)
}

export async function kickPlayer(playerId: string) {
  const { error } = await getSupabase().rpc('kick_player', { p_player_id: playerId })
  if (error) throw toAppError(error)
}

export async function setSessionLocked(sessionId: string, locked: boolean) {
  const { error } = await getSupabase().rpc('set_session_locked', { p_session_id: sessionId, p_locked: locked })
  if (error) throw toAppError(error)
}

export async function deleteSession(sessionId: string) {
  const { error } = await getSupabase().from('game_sessions').delete().eq('id', sessionId)
  if (error) throw toAppError(error)
}

/* ------------------------------------------------------------------ history */

export const sessionSummarySchema = gameSessionSchema.extend({
  players: z.array(z.object({ count: z.number() })),
})
export type SessionSummary = z.infer<typeof sessionSummarySchema> & { playerCount: number }

export async function listMySessions(hostId: string, opts: { limit?: number; quizId?: string } = {}): Promise<SessionSummary[]> {
  let query = getSupabase()
    .from('game_sessions')
    .select('*, players(count)')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false })
  if (opts.quizId) query = query.eq('quiz_id', opts.quizId)
  if (opts.limit) query = query.limit(opts.limit)
  return z
    .array(sessionSummarySchema)
    .parse(unwrap(await query))
    .map((s) => ({ ...s, playerCount: s.players[0]?.count ?? 0 }))
}

export interface DashboardStats {
  quizzes: number
  games: number
  players: number
  /** null when no graded answer exists yet */
  accuracy: number | null
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const sb = getSupabase()
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count: n, error } = await q
    if (error) throw toAppError(error)
    return n ?? 0
  }
  const [quizzes, games, players, correct, graded] = await Promise.all([
    count(sb.from('quizzes').select('id', { count: 'exact', head: true }).eq('owner_id', userId)),
    count(sb.from('game_sessions').select('id', { count: 'exact', head: true }).eq('host_id', userId)),
    count(
      sb.from('players').select('id, game_sessions!inner(host_id)', { count: 'exact', head: true }).eq('game_sessions.host_id', userId),
    ),
    count(
      sb
        .from('player_answers')
        .select('id, game_sessions!inner(host_id)', { count: 'exact', head: true })
        .eq('game_sessions.host_id', userId)
        .eq('is_correct', true),
    ),
    count(
      sb
        .from('player_answers')
        .select('id, game_sessions!inner(host_id)', { count: 'exact', head: true })
        .eq('game_sessions.host_id', userId)
        .not('is_correct', 'is', null),
    ),
  ])
  return { quizzes, games, players, accuracy: graded > 0 ? correct / graded : null }
}
