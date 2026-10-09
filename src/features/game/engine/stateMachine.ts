/**
 * Live game state machine.
 *
 *   LOBBY → QUESTION_INTRO → QUESTION_ACTIVE → QUESTION_RESULTS
 *        ↑                                         │
 *        └──────────── LEADERBOARD ←───────────────┤ (more questions)
 *                                                  ↓ (last question)
 *                                            FINAL_RESULTS → FINISHED
 *
 * Any state may jump to FINISHED when the host ends the game.
 * The database enforces the same transitions (`public.host_advance`).
 */

export const GAME_STATES = [
  'LOBBY',
  'QUESTION_INTRO',
  'QUESTION_ACTIVE',
  'QUESTION_RESULTS',
  'LEADERBOARD',
  'FINAL_RESULTS',
  'FINISHED',
] as const

export type GameState = (typeof GAME_STATES)[number]

export interface GameProgress {
  state: GameState
  /** -1 before the first question. */
  currentIndex: number
  questionCount: number
}

/** The state that follows `progress` when the host presses "next". */
export function nextState(progress: GameProgress): GameProgress {
  const { state, currentIndex, questionCount } = progress
  switch (state) {
    case 'LOBBY':
      return { ...progress, state: 'QUESTION_INTRO', currentIndex: 0 }
    case 'QUESTION_INTRO':
      return { ...progress, state: 'QUESTION_ACTIVE' }
    case 'QUESTION_ACTIVE':
      return { ...progress, state: 'QUESTION_RESULTS' }
    case 'QUESTION_RESULTS':
      return currentIndex >= questionCount - 1
        ? { ...progress, state: 'FINAL_RESULTS' }
        : { ...progress, state: 'LEADERBOARD' }
    case 'LEADERBOARD':
      return { ...progress, state: 'QUESTION_INTRO', currentIndex: currentIndex + 1 }
    case 'FINAL_RESULTS':
      return { ...progress, state: 'FINISHED' }
    case 'FINISHED':
      throw new Error('A finished game has no next state')
  }
}

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  LOBBY: ['QUESTION_INTRO', 'FINISHED'],
  QUESTION_INTRO: ['QUESTION_ACTIVE', 'FINISHED'],
  QUESTION_ACTIVE: ['QUESTION_RESULTS', 'FINISHED'],
  QUESTION_RESULTS: ['LEADERBOARD', 'FINAL_RESULTS', 'FINISHED'],
  LEADERBOARD: ['QUESTION_INTRO', 'FINISHED'],
  FINAL_RESULTS: ['FINISHED'],
  FINISHED: [],
}

export function canTransition(from: GameState, to: GameState): boolean {
  return TRANSITIONS[from].includes(to)
}

export function isGameState(value: unknown): value is GameState {
  return typeof value === 'string' && (GAME_STATES as readonly string[]).includes(value)
}

/** States during which a question is on screen. */
export function hasCurrentQuestion(state: GameState) {
  return state === 'QUESTION_INTRO' || state === 'QUESTION_ACTIVE' || state === 'QUESTION_RESULTS'
}

/** States in which the correct answer of the current question is known to players. */
export function isAnswerRevealed(state: GameState) {
  return state === 'QUESTION_RESULTS' || state === 'LEADERBOARD' || state === 'FINAL_RESULTS' || state === 'FINISHED'
}

export function isGameOver(state: GameState) {
  return state === 'FINAL_RESULTS' || state === 'FINISHED'
}
