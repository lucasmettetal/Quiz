/**
 * Score rules for a single question.
 *
 * The authoritative computation runs in PostgreSQL
 * (`public.compute_question_score`, see supabase/migrations/…_game_engine.sql);
 * this module is its TypeScript twin, used for previews and kept in lockstep
 * by the parity test in tests/db/engine.test.ts.
 */

export interface ScoringRules {
  /** Share of the points kept when answering at the very last moment (0–1). */
  minSpeedFactor: number
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  minSpeedFactor: 0.5,
}

export interface QuestionScoreInput {
  /** Points the question is worth (0 = not scored). */
  points: number
  timeLimitMs: number
  /** Time between the question opening and the answer, measured by the server. */
  elapsedMs: number
  /** `null` for ungraded questions such as polls. */
  isCorrect: boolean | null
}

/** Linear factor from 1 (instant answer) down to `minSpeedFactor` (at the buzzer). */
export function speedFactor(elapsedMs: number, timeLimitMs: number, rules: ScoringRules = DEFAULT_SCORING_RULES) {
  if (timeLimitMs <= 0) return rules.minSpeedFactor
  const ratio = Math.min(Math.max(elapsedMs, 0) / timeLimitMs, 1)
  return 1 - (1 - rules.minSpeedFactor) * ratio
}

export function calculateQuestionScore(input: QuestionScoreInput, rules: ScoringRules = DEFAULT_SCORING_RULES): number {
  const { points, timeLimitMs, elapsedMs, isCorrect } = input
  if (isCorrect !== true || points <= 0 || timeLimitMs <= 0) return 0
  return Math.round(points * speedFactor(elapsedMs, timeLimitMs, rules))
}
