import { beforeAll, describe, expect, it } from 'vitest'
import { calculateQuestionScore } from '../../src/features/game/engine/scoring'
import { nextState, type GameProgress, type GameState } from '../../src/features/game/engine/stateMachine'
import { createTestDb, type TestDb } from './harness'

interface Session { id: string; pin: string; state: GameState; current_index: number; question_count: number }
interface Player { id: string; nickname: string; status: string }
interface PlayerView {
  session: { state: GameState; current_index: number }
  player: { score: number; rank: number | null; last_points: number; streak: number }
  question: { id: string; type: string; content: Record<string, unknown>; solution: unknown } | null
  answer: { is_correct: boolean | null; points: number | null } | null
}

const Q_SINGLE = {
  id: crypto.randomUUID(), type: 'quiz', prompt: 'Capitale de la France ?', time_limit_s: 20, points: 1000,
  content: { options: [{ id: 'a', text: 'Paris', correct: true }, { id: 'b', text: 'Lyon', correct: false }] },
}
const Q_TEXT = {
  id: crypto.randomUUID(), type: 'text', prompt: 'Symbole chimique de l’or ?', time_limit_s: 30, points: 2000,
  content: { accepted: ['Au'] },
}
const Q_POLL = {
  id: crypto.randomUUID(), type: 'poll', prompt: 'Vous avez aimé ?', time_limit_s: 10, points: 0,
  content: { options: [{ id: 'y', text: 'Oui' }, { id: 'n', text: 'Non' }] },
}

async function createQuiz(db: TestDb, owner: string, questions: object[], title = 'Géographie') {
  const quiz = await db.as(owner, async () => (await db.query<{ id: string; version: number }>(
    `insert into public.quizzes (title) values ($1) returning id, version`, [title]))[0]!)
  // Fresh ids: a question id belongs to a single quiz.
  const fresh = questions.map((q) => ({ ...q, id: crypto.randomUUID() }))
  await db.rpc(owner, 'save_quiz', { p_quiz_id: quiz.id, p_expected_version: quiz.version, p_quiz: {}, p_questions: fresh })
  return quiz.id
}

describe('game engine (PostgreSQL)', () => {
  let db: TestDb
  let host: string

  beforeAll(async () => {
    db = await createTestDb()
    host = await db.createUser({ name: 'Mme Durand' })
  })

  it('scoring formula matches the TypeScript implementation', async () => {
    const cases: Array<[number, number, number, boolean | null]> = []
    for (const points of [0, 1000, 2000])
      for (const limit of [5000, 20000, 240000])
        for (const elapsed of [-10, 0, 1, 333, 2500, 4999, 5000, 12345, 19999, 20000, 300000])
          for (const correct of [true, false, null]) cases.push([points, limit, elapsed, correct])

    const rows = await db.query<{ i: number; score: number }>(
      `select i, public.compute_question_score((c->>0)::int, (c->>1)::int, (c->>2)::int, (c->>3)::boolean) as score
         from jsonb_array_elements($1::jsonb) with ordinality t(c, i)`,
      [JSON.stringify(cases)],
    )
    for (const { i, score } of rows) {
      const [points, timeLimitMs, elapsedMs, isCorrect] = cases[i - 1]!
      expect(score, JSON.stringify(cases[i - 1])).toBe(calculateQuestionScore({ points, timeLimitMs, elapsedMs, isCorrect }))
    }
  })

  it('runs a complete game following the shared state machine', async () => {
    const quizId = await createQuiz(db, host, [Q_SINGLE, Q_TEXT])
    const session = await db.rpcRow<Session>(host, 'create_game_session', { p_quiz_id: quizId })
    expect(session.pin).toMatch(/^[1-9]\d{5}$/)
    expect(session.state).toBe('LOBBY')

    // Signed-out visitor checks the PIN.
    const found = await db.rpc<{ session_id: string; reason: string | null }>(null, 'find_session', { p_pin: session.pin })
    expect(found).toMatchObject({ session_id: session.id, reason: null })
    expect(await db.rpc(null, 'find_session', { p_pin: '000000' })).toBeNull()

    const alice = await db.createUser({ anonymous: true })
    const bob = await db.createUser({ anonymous: true })
    const pAlice = await db.rpcRow<Player>(alice, 'join_session', { p_pin: session.pin, p_nickname: '  Alice  ' })
    expect(pAlice.nickname).toBe('Alice')
    await expect(db.rpcRow(bob, 'join_session', { p_pin: session.pin, p_nickname: 'alice' })).rejects.toThrow('NICKNAME_TAKEN')
    await expect(db.rpcRow(bob, 'join_session', { p_pin: '999999', p_nickname: 'Bob' })).rejects.toThrow('PIN_NOT_FOUND')
    const pBob = await db.rpcRow<Player>(bob, 'join_session', { p_pin: session.pin, p_nickname: 'Bob' })

    // Rejoining (refresh) returns the same player.
    const again = await db.rpcRow<Player>(alice, 'join_session', { p_pin: session.pin, p_nickname: 'Other' })
    expect(again.id).toBe(pAlice.id)

    // Only the host drives the game.
    await expect(db.rpcRow(alice, 'host_advance', { p_session_id: session.id, p_from_state: 'LOBBY' })).rejects.toThrow('NOT_AUTHORIZED')

    let progress: GameProgress = { state: 'LOBBY', currentIndex: -1, questionCount: 2 }
    const advance = async () => {
      const s = await db.rpcRow<Session>(host, 'host_advance', { p_session_id: session.id, p_from_state: progress.state })
      const expected = nextState(progress)
      expect({ state: s.state, index: s.current_index }).toEqual({ state: expected.state, index: expected.currentIndex })
      progress = expected
      return s
    }

    await advance() // → QUESTION_INTRO
    // A duplicate "next" for an outdated state is a harmless no-op.
    const noop = await db.rpcRow<Session>(host, 'host_advance', { p_session_id: session.id, p_from_state: 'LOBBY' })
    expect(noop.state).toBe('QUESTION_INTRO')

    const intro = await db.rpc<PlayerView>(alice, 'get_player_view', { p_session_id: session.id })
    await expect(db.rpc(alice, 'submit_answer', {
      p_session_id: session.id, p_game_question_id: intro.question!.id, p_answer: { optionIds: ['a'] },
    })).rejects.toThrow('QUESTION_CLOSED')

    await advance() // → QUESTION_ACTIVE
    const active = await db.rpc<PlayerView>(alice, 'get_player_view', { p_session_id: session.id })
    // Players never receive the correct answer while the question is open.
    expect(JSON.stringify(active.question!.content)).not.toContain('correct')
    expect(active.question!.solution).toBeNull()
    expect(active.question!.content).toMatchObject({ multi: false, options: [{ id: 'a', text: 'Paris' }, { id: 'b', text: 'Lyon' }] })

    const q1 = active.question!.id
    await expect(db.rpc(alice, 'submit_answer', {
      p_session_id: session.id, p_game_question_id: q1, p_answer: { optionIds: ['zzz'] },
    })).rejects.toThrow('INVALID_ANSWER')
    await db.rpc(alice, 'submit_answer', { p_session_id: session.id, p_game_question_id: q1, p_answer: { optionIds: ['a'] } })
    await expect(db.rpc(alice, 'submit_answer', {
      p_session_id: session.id, p_game_question_id: q1, p_answer: { optionIds: ['b'] },
    })).rejects.toThrow('ALREADY_ANSWERED')

    // Players cannot peek at stored answers.
    expect(await db.as(alice, () => db.query('select * from public.player_answers'))).toHaveLength(0)
    expect(await db.as(host, () => db.query('select * from public.player_answers'))).toHaveLength(1)

    // The last answer closes the question automatically.
    await db.rpc(bob, 'submit_answer', { p_session_id: session.id, p_game_question_id: q1, p_answer: { optionIds: ['b'] } })
    progress = nextState(progress) // → QUESTION_RESULTS
    const [afterQ1] = await db.as(host, () => db.query<Session>('select * from public.game_sessions where id = $1', [session.id]))
    expect(afterQ1!.state).toBe('QUESTION_RESULTS')

    const aliceResult = await db.rpc<PlayerView>(alice, 'get_player_view', { p_session_id: session.id })
    expect(aliceResult.answer!.is_correct).toBe(true)
    expect(aliceResult.answer!.points).toBeGreaterThan(500)
    expect(aliceResult.player).toMatchObject({ rank: 1, streak: 1, last_points: aliceResult.answer!.points })
    expect(aliceResult.question!.solution).toEqual({ optionIds: ['a'] })
    const bobResult = await db.rpc<PlayerView>(bob, 'get_player_view', { p_session_id: session.id })
    expect(bobResult.answer).toMatchObject({ is_correct: false, points: 0 })
    expect(bobResult.player).toMatchObject({ rank: 2, score: 0 })

    await advance() // → LEADERBOARD
    await advance() // → QUESTION_INTRO (q2)

    // Late joiner is accepted mid-game.
    const carol = await db.createUser({ anonymous: true })
    const pCarol = await db.rpcRow<Player>(carol, 'join_session', { p_pin: session.pin, p_nickname: 'Carol' })

    await advance() // → QUESTION_ACTIVE
    const q2 = (await db.rpc<PlayerView>(bob, 'get_player_view', { p_session_id: session.id })).question!.id
    await db.rpc(bob, 'submit_answer', { p_session_id: session.id, p_game_question_id: q2, p_answer: { text: '  au ' } })

    // Host removes Carol; her answer is no longer awaited.
    await expect(db.rpc(bob, 'kick_player', { p_player_id: pCarol.id })).rejects.toThrow('NOT_AUTHORIZED')
    await db.rpc(host, 'kick_player', { p_player_id: pCarol.id })
    await expect(db.rpcRow(carol, 'join_session', { p_pin: session.pin, p_nickname: 'Carol2' })).rejects.toThrow('KICKED')

    // Deadline passed (simulated): answers are refused.
    await db.query(`update public.game_sessions set question_deadline = now() - interval '5 seconds' where id = $1`, [session.id])
    await expect(db.rpc(alice, 'submit_answer', {
      p_session_id: session.id, p_game_question_id: q2, p_answer: { text: 'Au' },
    })).rejects.toThrow('TIME_UP')

    await advance() // → QUESTION_RESULTS (timer ended, host closes)
    const bobFinal = await db.rpc<PlayerView>(bob, 'get_player_view', { p_session_id: session.id })
    expect(bobFinal.answer!.is_correct).toBe(true) // case-insensitive, trimmed
    const aliceAfter = await db.rpc<PlayerView>(alice, 'get_player_view', { p_session_id: session.id })
    expect(aliceAfter.player.streak).toBe(0)

    await advance() // last question → FINAL_RESULTS
    expect(progress.state).toBe('FINAL_RESULTS')
    const lateVisitor = await db.createUser({ anonymous: true })
    await expect(db.rpcRow(lateVisitor, 'join_session', { p_pin: session.pin, p_nickname: 'Dan' })).rejects.toThrow('GAME_FINISHED')

    await advance() // → FINISHED
    expect(await db.rpc(null, 'find_session', { p_pin: session.pin })).toBeNull()

    const [quiz] = await db.query<{ play_count: number }>('select play_count from public.quizzes where id = $1', [quizId])
    expect(quiz!.play_count).toBe(1)
    void pBob
  })

  it('handles polls without grading or breaking streaks', async () => {
    const quizId = await createQuiz(db, host, [Q_POLL])
    const s = await db.rpcRow<Session>(host, 'create_game_session', { p_quiz_id: quizId })
    const u = await db.createUser({ anonymous: true })
    await db.rpcRow(u, 'join_session', { p_pin: s.pin, p_nickname: 'Zoé' })
    await db.rpcRow(host, 'host_advance', { p_session_id: s.id, p_from_state: 'LOBBY' })
    await db.rpcRow(host, 'host_advance', { p_session_id: s.id, p_from_state: 'QUESTION_INTRO' })
    const view = await db.rpc<PlayerView>(u, 'get_player_view', { p_session_id: s.id })
    await expect(db.rpc(u, 'submit_answer', {
      p_session_id: s.id, p_game_question_id: view.question!.id, p_answer: { optionIds: ['y', 'n'] },
    })).rejects.toThrow('INVALID_ANSWER')
    await db.rpc(u, 'submit_answer', { p_session_id: s.id, p_game_question_id: view.question!.id, p_answer: { optionIds: ['y'] } })
    const after = await db.rpc<PlayerView>(u, 'get_player_view', { p_session_id: s.id })
    expect(after.session.state).toBe('QUESTION_RESULTS')
    expect(after.answer).toMatchObject({ is_correct: null, points: 0 })
  })

  it('refuses to start without players and to launch invalid quizzes', async () => {
    const quizId = await createQuiz(db, host, [Q_SINGLE])
    const s = await db.rpcRow<Session>(host, 'create_game_session', { p_quiz_id: quizId })
    await expect(db.rpcRow(host, 'host_advance', { p_session_id: s.id, p_from_state: 'LOBBY' })).rejects.toThrow('NO_PLAYERS')

    const invalid = await createQuiz(db, host, [{ ...Q_SINGLE, id: crypto.randomUUID(), content: { options: [{ id: 'a', text: 'Seule', correct: false }] } }])
    await expect(db.rpcRow(host, 'create_game_session', { p_quiz_id: invalid })).rejects.toThrow('QUIZ_INVALID')

    const player = await db.createUser({ anonymous: true })
    await expect(db.rpcRow(player, 'create_game_session', { p_quiz_id: quizId })).rejects.toThrow('NOT_AUTHENTICATED')
  })

  it('enforces capacity and lock', async () => {
    const quizId = await createQuiz(db, host, [Q_SINGLE])
    const s = await db.rpcRow<Session>(host, 'create_game_session', { p_quiz_id: quizId, p_options: { max_players: 1 } })
    await db.rpcRow(await db.createUser({ anonymous: true }), 'join_session', { p_pin: s.pin, p_nickname: 'Un' })
    await expect(db.rpcRow(await db.createUser({ anonymous: true }), 'join_session', { p_pin: s.pin, p_nickname: 'Deux' }))
      .rejects.toThrow('GAME_FULL')

    const s2 = await db.rpcRow<Session>(host, 'create_game_session', { p_quiz_id: quizId })
    await db.rpc(host, 'set_session_locked', { p_session_id: s2.id, p_locked: true })
    await expect(db.rpcRow(await db.createUser({ anonymous: true }), 'join_session', { p_pin: s2.pin, p_nickname: 'Trois' }))
      .rejects.toThrow('GAME_LOCKED')
  })
})
