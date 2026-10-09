/**
 * Domain events of a live game, derived from database changes received
 * through Supabase Realtime. Screens react to these instead of guessing from
 * raw rows.
 */
import type { GameSession, Player, PlayerAnswer } from '@/types/database'

export type GameEvent =
  | { type: 'player_joined'; player: Player }
  | { type: 'player_left'; player: Player; reason: 'left' | 'kicked' }
  | { type: 'player_updated'; player: Player }
  | { type: 'game_started'; session: GameSession }
  | { type: 'question_started'; session: GameSession }
  | { type: 'question_ended'; session: GameSession }
  | { type: 'leaderboard_updated'; session: GameSession }
  | { type: 'game_finished'; session: GameSession }
  | { type: 'session_updated'; session: GameSession }
  | { type: 'answer_submitted'; answer: PlayerAnswer }

export type GameEventType = GameEvent['type']

/** Event for a game_sessions change (prev = last known row, if any). */
export function sessionEvent(prev: Pick<GameSession, 'state' | 'current_index'> | null | undefined, next: GameSession): GameEvent {
  const changed = !prev || prev.state !== next.state || prev.current_index !== next.current_index
  if (changed) {
    if (prev?.state === 'LOBBY' && next.state === 'QUESTION_INTRO') return { type: 'game_started', session: next }
    if (next.state === 'QUESTION_ACTIVE') return { type: 'question_started', session: next }
    if (next.state === 'QUESTION_RESULTS') return { type: 'question_ended', session: next }
    if (next.state === 'LEADERBOARD') return { type: 'leaderboard_updated', session: next }
    if (next.state === 'FINAL_RESULTS' || next.state === 'FINISHED') return { type: 'game_finished', session: next }
  }
  return { type: 'session_updated', session: next }
}

/** Event for a players change (prev undefined = insert). */
export function playerEvent(prev: Pick<Player, 'status'> | null | undefined, next: Player): GameEvent {
  if (next.status === 'left' || next.status === 'kicked') {
    if (prev?.status !== next.status) return { type: 'player_left', player: next, reason: next.status }
    return { type: 'player_updated', player: next }
  }
  if (!prev || prev.status !== 'active') return { type: 'player_joined', player: next }
  return { type: 'player_updated', player: next }
}

/** Applies a player change to a roster, keeping join order. */
export function upsertPlayer(players: Player[], next: Player): Player[] {
  const index = players.findIndex((p) => p.id === next.id)
  if (index === -1) return [...players, next]
  const copy = players.slice()
  copy[index] = next
  return copy
}

/** Leaderboard order: rank (server-computed) then score then arrival. */
export function sortLeaderboard(players: Player[]): Player[] {
  return players
    .filter((p) => p.status !== 'kicked')
    .slice()
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || b.score - a.score || a.joined_at.localeCompare(b.joined_at))
}
