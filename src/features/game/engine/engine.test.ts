import { describe, expect, it } from 'vitest'
import type { GameSession, Player } from '@/types/database'
import { estimateClockOffset, remainingMs } from './clock'
import { playerEvent, sessionEvent, sortLeaderboard, upsertPlayer } from './events'
import { calculateQuestionScore, speedFactor } from './scoring'
import { canTransition, nextState, type GameProgress } from './stateMachine'

describe('calculateQuestionScore', () => {
  const base = { points: 1000, timeLimitMs: 20_000 }
  it('rewards speed linearly from 100% to 50%', () => {
    expect(calculateQuestionScore({ ...base, elapsedMs: 0, isCorrect: true })).toBe(1000)
    expect(calculateQuestionScore({ ...base, elapsedMs: 10_000, isCorrect: true })).toBe(750)
    expect(calculateQuestionScore({ ...base, elapsedMs: 20_000, isCorrect: true })).toBe(500)
    expect(calculateQuestionScore({ ...base, elapsedMs: 99_000, isCorrect: true })).toBe(500)
  })
  it('gives nothing for wrong, ungraded or pointless questions', () => {
    expect(calculateQuestionScore({ ...base, elapsedMs: 0, isCorrect: false })).toBe(0)
    expect(calculateQuestionScore({ ...base, elapsedMs: 0, isCorrect: null })).toBe(0)
    expect(calculateQuestionScore({ points: 0, timeLimitMs: 20_000, elapsedMs: 0, isCorrect: true })).toBe(0)
  })
  it('accepts custom rules', () => {
    expect(speedFactor(10_000, 20_000, { minSpeedFactor: 1 })).toBe(1)
    expect(calculateQuestionScore({ ...base, elapsedMs: 20_000, isCorrect: true }, { minSpeedFactor: 0 })).toBe(0)
  })
})

describe('game state machine', () => {
  it('walks a 2-question game', () => {
    let p: GameProgress = { state: 'LOBBY', currentIndex: -1, questionCount: 2 }
    const seen: string[] = []
    while (p.state !== 'FINISHED') {
      p = nextState(p)
      seen.push(`${p.state}#${p.currentIndex}`)
    }
    expect(seen).toEqual([
      'QUESTION_INTRO#0', 'QUESTION_ACTIVE#0', 'QUESTION_RESULTS#0', 'LEADERBOARD#0',
      'QUESTION_INTRO#1', 'QUESTION_ACTIVE#1', 'QUESTION_RESULTS#1', 'FINAL_RESULTS#1', 'FINISHED#1',
    ])
  })
  it('only allows declared transitions', () => {
    expect(canTransition('LOBBY', 'QUESTION_ACTIVE')).toBe(false)
    expect(canTransition('QUESTION_ACTIVE', 'FINISHED')).toBe(true)
    expect(canTransition('FINISHED', 'LOBBY')).toBe(false)
    expect(() => nextState({ state: 'FINISHED', currentIndex: 0, questionCount: 1 })).toThrow()
  })
})

describe('clock', () => {
  it('estimates the server offset from the round-trip midpoint', () => {
    expect(estimateClockOffset(new Date(10_500).toISOString(), 1000, 2000)).toBe(9000)
  })
  it('computes remaining time on the server clock', () => {
    const deadline = new Date(20_000).toISOString()
    expect(remainingMs(deadline, 0, 15_000)).toBe(5000)
    expect(remainingMs(deadline, 2000, 15_000)).toBe(3000)
    expect(remainingMs(deadline, 0, 25_000)).toBe(0)
    expect(remainingMs(null, 0, 0)).toBe(0)
  })
})

const session = (state: GameSession['state'], current_index = 0) => ({ state, current_index }) as GameSession
const player = (o: Partial<Player>): Player =>
  ({ id: 'p', session_id: 's', user_id: 'u', nickname: 'Zoé', avatar: 'teal', status: 'active', score: 0, last_points: 0, rank: null, previous_rank: null, streak: 0, correct_count: 0, joined_at: '2026-01-01T00:00:00Z', ...o }) as Player

describe('realtime events', () => {
  it('maps session transitions to game events', () => {
    expect(sessionEvent(session('LOBBY', -1), session('QUESTION_INTRO')).type).toBe('game_started')
    expect(sessionEvent(session('QUESTION_INTRO'), session('QUESTION_ACTIVE')).type).toBe('question_started')
    expect(sessionEvent(session('QUESTION_ACTIVE'), session('QUESTION_RESULTS')).type).toBe('question_ended')
    expect(sessionEvent(session('QUESTION_RESULTS'), session('LEADERBOARD')).type).toBe('leaderboard_updated')
    expect(sessionEvent(session('QUESTION_RESULTS'), session('FINAL_RESULTS')).type).toBe('game_finished')
    expect(sessionEvent(session('LOBBY', -1), session('LOBBY', -1)).type).toBe('session_updated')
  })
  it('maps player changes', () => {
    expect(playerEvent(undefined, player({})).type).toBe('player_joined')
    expect(playerEvent(player({}), player({ status: 'kicked' }))).toMatchObject({ type: 'player_left', reason: 'kicked' })
    expect(playerEvent(player({ status: 'left' }), player({})).type).toBe('player_joined')
    expect(playerEvent(player({}), player({ score: 10 })).type).toBe('player_updated')
  })
  it('upserts and sorts the leaderboard', () => {
    const a = player({ id: 'a', score: 100, rank: 2 })
    const b = player({ id: 'b', score: 300, rank: 1 })
    const roster = upsertPlayer(upsertPlayer([], a), b)
    expect(sortLeaderboard(roster).map((p) => p.id)).toEqual(['b', 'a'])
    expect(upsertPlayer(roster, { ...a, status: 'kicked' })).toHaveLength(2)
    expect(sortLeaderboard(upsertPlayer(roster, { ...a, status: 'kicked' })).map((p) => p.id)).toEqual(['b'])
  })
})
