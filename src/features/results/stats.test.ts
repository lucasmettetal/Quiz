import { describe, expect, it } from 'vitest'
import type { Question } from '@/features/questions/model'
import type { Player, PlayerAnswer } from '@/types/database'
import { answerDistribution, buildReport, playersCsv, toCsv } from './stats'

const quizQ: Question & { position: number } = {
  id: 'q1', position: 0, type: 'quiz', prompt: 'P', media: null, time_limit_s: 20, points: 1000,
  content: { options: [{ id: 'a', text: 'Paris', correct: true }, { id: 'b', text: 'Lyon', correct: false }] },
}
const textQ: Question & { position: number } = {
  id: 'q2', position: 1, type: 'text', prompt: 'T', media: null, time_limit_s: 20, points: 1000,
  content: { accepted: ['Oslo'], caseSensitive: false },
}
const pollQ: Question & { position: number } = {
  id: 'q3', position: 2, type: 'poll', prompt: 'S', media: null, time_limit_s: 20, points: 0,
  content: { options: [{ id: 'x', text: 'Oui' }, { id: 'y', text: 'Non' }] },
}

const answer = (o: Partial<PlayerAnswer>): PlayerAnswer =>
  ({ id: crypto.randomUUID(), session_id: 's', game_question_id: 'q1', player_id: 'p1', answer: {}, is_correct: null, points: 0, elapsed_ms: 1000, submitted_at: '', ...o }) as PlayerAnswer
const player = (id: string, o: Partial<Player> = {}): Player =>
  ({ id, session_id: 's', user_id: id, nickname: id, avatar: 'teal', status: 'active', score: 0, last_points: 0, rank: 1, previous_rank: null, streak: 0, correct_count: 0, joined_at: '2026-01-01', ...o }) as Player

const answers = [
  answer({ player_id: 'p1', answer: { optionIds: ['a'] }, is_correct: true, points: 900, elapsed_ms: 2000 }),
  answer({ player_id: 'p2', answer: { optionIds: ['b'] }, is_correct: false, elapsed_ms: 4000 }),
  answer({ player_id: 'p1', game_question_id: 'q2', answer: { text: ' oslo' }, is_correct: true, points: 800 }),
  answer({ player_id: 'p2', game_question_id: 'q2', answer: { text: 'OSLO ' }, is_correct: true, points: 600 }),
  answer({ player_id: 'p3', game_question_id: 'q2', answer: { text: 'Bergen' }, is_correct: false }),
  answer({ player_id: 'p1', game_question_id: 'q3', answer: { optionIds: ['y'] } }),
]
const players = [player('p1', { score: 1700, rank: 1, correct_count: 2 }), player('p2', { score: 600, rank: 2 }), player('p3', { rank: 3 }), player('p4', { status: 'kicked' })]

describe('stats', () => {
  it('counts choices and groups typed answers', () => {
    expect(answerDistribution(quizQ, answers.filter((a) => a.game_question_id === 'q1')).map((b) => [b.key, b.count, b.correct])).toEqual([
      ['a', 1, true],
      ['b', 1, false],
    ])
    const text = answerDistribution(textQ, answers.filter((a) => a.game_question_id === 'q2'))
    expect(text[0]).toMatchObject({ key: 'oslo', count: 2, correct: true })
    expect(text[1]).toMatchObject({ label: 'Bergen', count: 1, correct: false })
  })

  it('builds a report ignoring kicked players and ungraded questions', () => {
    const report = buildReport([quizQ, textQ, pollQ], players, answers)
    expect(report.playerCount).toBe(3)
    expect(report.questions[0]).toMatchObject({ answered: 2, correct: 1, accuracy: 1 / 3, avgElapsedMs: 3000 })
    expect(report.questions[2]).toMatchObject({ graded: false, accuracy: null, mostChosen: { key: 'y' } })
    expect(report.accuracy).toBeCloseTo((1 / 3 + 2 / 3) / 2)
    expect(report.hardest.map((q) => q.questionId)).toEqual(['q1', 'q2'])
    expect(report.avgScore).toBe(Math.round(2300 / 3))
  })

  it('exports CSV safely', () => {
    expect(toCsv([['a,b', '=SUM(A1)', 'say "hi"']])).toBe('﻿"a,b",\'=SUM(A1),"say ""hi"""')
    const csv = playersCsv([quizQ, textQ], players, answers, {
      rank: 'Rang', player: 'Joueur', score: 'Score', correct: 'Bonnes', question: (n) => `Q${n}`,
    })
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Rang,Joueur,Score,Bonnes,Q1,Q2')
    expect(lines[1]).toBe('1,p1,1700,2,900,800')
    expect(lines).toHaveLength(4) // header + 3 non-kicked players
  })
})
