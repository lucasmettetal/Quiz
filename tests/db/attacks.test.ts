/**
 * Adversarial tests: what a malicious user can try with the public API key
 * and their own session (PostgREST exposes every granted table and function).
 * Each test is an attack that must fail.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'

const ZERO = '00000000-0000-0000-0000-000000000000'
const QUIZ_Q = {
  type: 'quiz', prompt: 'Capitale de la France ?', time_limit_s: 20, points: 1000,
  content: { options: [{ id: 'a', text: 'Paris', correct: true }, { id: 'b', text: 'Lyon', correct: false }] },
}
const TEXT_Q = { type: 'text', prompt: 'Symbole de l’or ?', time_limit_s: 30, points: 1000, content: { accepted: ['Au'] } }

interface Session { id: string; pin: string }
interface View { session: { state: string }; question: { id: string; content: Record<string, unknown>; solution: unknown } | null }

describe('attacks on the API (PostgreSQL)', () => {
  let db: TestDb
  let victim: string
  let attacker: string

  beforeAll(async () => {
    db = await createTestDb()
    victim = await db.createUser({ name: 'Victime' })
    attacker = await db.createUser({ name: 'Attaquant' })
  })

  async function quizWith(owner: string, questions: object[], publish?: 'public' | 'unlisted') {
    const q = await db.as(owner, async () => (await db.query<{ id: string; version: number }>(
      `insert into public.quizzes (title) values ('Quiz') returning id, version`))[0]!)
    const withIds = questions.map((x) => ({ ...x, id: crypto.randomUUID() }))
    await db.rpc(owner, 'save_quiz', { p_quiz_id: q.id, p_expected_version: q.version, p_quiz: {}, p_questions: withIds })
    if (publish) await db.rpcRow(owner, 'publish_quiz', { p_quiz_id: q.id, p_visibility: publish })
    return { id: q.id, questionIds: withIds.map((x) => x.id) }
  }

  /** A live game of `quiz` hosted by `host`, with one player, on the first question. */
  async function liveGame(host: string, quizId: string) {
    const s = await db.rpcRow<Session>(host, 'create_game_session', { p_quiz_id: quizId })
    const player = await db.createUser({ anonymous: true })
    await db.rpcRow(player, 'join_session', { p_pin: s.pin, p_nickname: 'Joueur' })
    await db.rpcRow(host, 'host_advance', { p_session_id: s.id, p_from_state: 'LOBBY' })
    await db.rpcRow(host, 'host_advance', { p_session_id: s.id, p_from_state: 'QUESTION_INTRO' })
    return { session: s, player }
  }

  describe('signed-out visitor (anon role)', () => {
    it('cannot read any game table', async () => {
      for (const t of ['game_sessions', 'game_questions', 'players', 'player_answers', 'favorites', 'pin_lookup_misses']) {
        await expect(db.as(null, () => db.query(`select * from public.${t} limit 1`)), t).rejects.toThrow(/permission denied/)
      }
    })

    it('cannot write anything', async () => {
      await expect(db.as(null, () => db.query(`insert into public.quizzes (title) values ('x')`))).rejects.toThrow(/permission denied/)
      await expect(db.as(null, () => db.query(`update public.profiles set display_name = 'x'`))).rejects.toThrow(/permission denied/)
      await expect(db.as(null, () => db.query(`delete from public.questions`))).rejects.toThrow(/permission denied/)
    })

    it('cannot call any authoring or game function', async () => {
      for (const [fn, args] of [
        ['save_quiz', { p_quiz_id: ZERO, p_expected_version: 1, p_quiz: {}, p_questions: [] }],
        ['create_game_session', { p_quiz_id: ZERO }],
        ['join_session', { p_pin: '123456', p_nickname: 'x' }],
        ['submit_answer', { p_session_id: ZERO, p_game_question_id: ZERO, p_answer: {} }],
        ['get_player_view', { p_session_id: ZERO }],
        ['host_advance', { p_session_id: ZERO, p_from_state: 'LOBBY' }],
      ] as const) {
        await expect(db.rpc(null, fn, args), fn).rejects.toThrow(/permission denied/)
      }
    })

    it('sees no draft, private quiz or their questions, and no unrelated profile', async () => {
      const draft = await quizWith(victim, [QUIZ_Q])
      expect(await db.as(null, () => db.query('select id from public.quizzes where id = $1', [draft.id]))).toHaveLength(0)
      expect(await db.as(null, () => db.query('select id from public.questions where quiz_id = $1', [draft.id]))).toHaveLength(0)
      expect(await db.as(null, () => db.query('select id from public.profiles where id = $1', [victim]))).toHaveLength(0)
    })
  })

  describe('signed-in attacker against another creator', () => {
    it('cannot steal or move a victim question through save_quiz (IDOR on question ids)', async () => {
      const target = await quizWith(victim, [QUIZ_Q])
      const own = await db.as(attacker, async () => (await db.query<{ id: string; version: number }>(
        `insert into public.quizzes (title) values ('Mine') returning id, version`))[0]!)
      // Reuse the victim's question id with a rewritten payload.
      await db.rpc(attacker, 'save_quiz', {
        p_quiz_id: own.id, p_expected_version: own.version, p_quiz: {},
        p_questions: [{ ...QUIZ_Q, id: target.questionIds[0], prompt: 'Piraté' }],
      })
      const [q] = await db.query<{ quiz_id: string; prompt: string }>('select quiz_id, prompt from public.questions where id = $1', [target.questionIds[0]])
      expect(q).toEqual({ quiz_id: target.id, prompt: 'Capitale de la France ?' })
    })

    it('cannot write into a victim quiz in any way', async () => {
      const target = await quizWith(victim, [QUIZ_Q])
      await expect(db.rpc(attacker, 'save_quiz', { p_quiz_id: target.id, p_expected_version: 2, p_quiz: { title: 'x' }, p_questions: [] }))
        .rejects.toThrow('QUIZ_NOT_FOUND')
      await expect(db.rpcRow(attacker, 'publish_quiz', { p_quiz_id: target.id, p_visibility: 'public' })).rejects.toThrow('QUIZ_NOT_FOUND')
      await expect(db.as(attacker, () => db.query(
        `insert into public.questions (quiz_id, position, type, prompt) values ($1, 9, 'quiz', 'x')`, [target.id]))).rejects.toThrow(/row-level security/)
      await expect(db.as(attacker, () => db.query(`insert into public.quiz_tags (quiz_id, tag) values ($1, 'spam')`, [target.id])))
        .rejects.toThrow(/row-level security/)
      expect(await db.as(attacker, () => db.query(`update public.questions set prompt = 'x' where quiz_id = $1 returning id`, [target.id]))).toHaveLength(0)
      expect(await db.as(attacker, () => db.query(`delete from public.questions where quiz_id = $1 returning id`, [target.id]))).toHaveLength(0)
    })

    it('cannot duplicate, launch or favorite a private quiz', async () => {
      const target = await quizWith(victim, [QUIZ_Q])
      await expect(db.rpc(attacker, 'duplicate_quiz', { p_quiz_id: target.id, p_title: 'copie' })).rejects.toThrow('QUIZ_NOT_FOUND')
      await expect(db.rpcRow(attacker, 'create_game_session', { p_quiz_id: target.id })).rejects.toThrow('QUIZ_NOT_FOUND')
      await expect(db.as(attacker, () => db.query('insert into public.favorites (quiz_id) values ($1)', [target.id])))
        .rejects.toThrow(/row-level security/)
    })

    it('cannot take over a profile or a quiz', async () => {
      expect(await db.as(attacker, () => db.query(`update public.profiles set display_name = 'x' where id = $1 returning id`, [victim]))).toHaveLength(0)
      await expect(db.as(attacker, () => db.query(`update public.profiles set id = $1 where id = $2`, [victim, attacker]))).rejects.toThrow(/permission denied/)
      const mine = await quizWith(attacker, [QUIZ_Q])
      await expect(db.as(attacker, () => db.query(`update public.quizzes set owner_id = $1 where id = $2`, [victim, mine.id]))).rejects.toThrow(/permission denied/)
      await expect(db.as(attacker, () => db.query(`update public.quizzes set version = 1 where id = $1`, [mine.id]))).rejects.toThrow(/permission denied/)
    })

    it('cannot read, drive or delete a game hosted by someone else', async () => {
      const quiz = await quizWith(victim, [QUIZ_Q])
      const { session } = await liveGame(victim, quiz.id)
      for (const t of ['game_sessions', 'game_questions', 'players', 'player_answers']) {
        const col = t === 'game_sessions' ? 'id' : 'session_id'
        expect(await db.as(attacker, () => db.query(`select * from public.${t} where ${col} = $1`, [session.id])), t).toHaveLength(0)
      }
      await expect(db.rpcRow(attacker, 'host_advance', { p_session_id: session.id, p_from_state: 'QUESTION_ACTIVE' })).rejects.toThrow('NOT_AUTHORIZED')
      await expect(db.rpc(attacker, 'host_end_game', { p_session_id: session.id })).rejects.toThrow('NOT_AUTHORIZED')
      await expect(db.rpc(attacker, 'set_session_locked', { p_session_id: session.id, p_locked: true })).rejects.toThrow('NOT_AUTHORIZED')
      expect(await db.as(attacker, () => db.query('delete from public.game_sessions where id = $1 returning id', [session.id]))).toHaveLength(0)
    })
  })

  describe('player trying to cheat', () => {
    it('never sees the answer before the question closes', async () => {
      const quiz = await quizWith(victim, [QUIZ_Q, TEXT_Q])
      const { session, player } = await liveGame(victim, quiz.id)
      expect(await db.as(player, () => db.query('select * from public.game_questions where session_id = $1', [session.id]))).toHaveLength(0)
      expect(await db.as(player, () => db.query('select * from public.player_answers where session_id = $1', [session.id]))).toHaveLength(0)
      const view = await db.rpc<View>(player, 'get_player_view', { p_session_id: session.id })
      expect(view.question!.solution).toBeNull()
      expect(JSON.stringify(view.question!.content)).not.toContain('correct')
      // Private quiz: the source questions are not readable either.
      expect(await db.as(player, () => db.query('select * from public.questions where quiz_id = $1', [quiz.id]))).toHaveLength(0)
    })

    it('cannot forge, repeat, delay or redirect an answer', async () => {
      const quiz = await quizWith(victim, [QUIZ_Q, TEXT_Q])
      const { session, player } = await liveGame(victim, quiz.id)
      const other = await db.createUser({ anonymous: true })
      await db.rpcRow(other, 'join_session', { p_pin: session.pin, p_nickname: 'Autre' })
      const view = await db.rpc<View>(player, 'get_player_view', { p_session_id: session.id })
      const qid = view.question!.id

      // Malformed payloads.
      for (const answer of [{ optionIds: ['zzz'] }, { optionIds: ['a', 'a'] }, { optionIds: [] }, { optionIds: 'a' }, { optionIds: [1] }, { value: true }, {}, [], 42]) {
        await expect(db.rpc(player, 'submit_answer', { p_session_id: session.id, p_game_question_id: qid, p_answer: answer }), JSON.stringify(answer))
          .rejects.toThrow('INVALID_ANSWER')
      }
      // Answering a question that is not the current one.
      const [next] = await db.query<{ id: string }>('select id from public.game_questions where session_id = $1 and position = 1', [session.id])
      await expect(db.rpc(player, 'submit_answer', { p_session_id: session.id, p_game_question_id: next!.id, p_answer: { text: 'Au' } }))
        .rejects.toThrow('QUESTION_CLOSED')
      // Answering in a game you did not join.
      const stranger = await db.createUser({ anonymous: true })
      await expect(db.rpc(stranger, 'submit_answer', { p_session_id: session.id, p_game_question_id: qid, p_answer: { optionIds: ['a'] } }))
        .rejects.toThrow('NOT_IN_GAME')

      // One valid answer, then no second chance.
      await db.rpc(player, 'submit_answer', { p_session_id: session.id, p_game_question_id: qid, p_answer: { optionIds: ['b'] } })
      await expect(db.rpc(player, 'submit_answer', { p_session_id: session.id, p_game_question_id: qid, p_answer: { optionIds: ['a'] } }))
        .rejects.toThrow('ALREADY_ANSWERED')

      // After the deadline (+ grace), the other player is refused.
      await db.query(`update public.game_sessions set question_deadline = now() - interval '5 seconds' where id = $1`, [session.id])
      await expect(db.rpc(other, 'submit_answer', { p_session_id: session.id, p_game_question_id: qid, p_answer: { optionIds: ['a'] } }))
        .rejects.toThrow('TIME_UP')
    })

    it('cannot kick others, and a kicked player stays out', async () => {
      const quiz = await quizWith(victim, [QUIZ_Q])
      const s = await db.rpcRow<Session>(victim, 'create_game_session', { p_quiz_id: quiz.id })
      const a = await db.createUser({ anonymous: true })
      const b = await db.createUser({ anonymous: true })
      const pa = await db.rpcRow<{ id: string }>(a, 'join_session', { p_pin: s.pin, p_nickname: 'A' })
      const pb = await db.rpcRow<{ id: string }>(b, 'join_session', { p_pin: s.pin, p_nickname: 'B' })
      await expect(db.rpc(a, 'kick_player', { p_player_id: pb.id })).rejects.toThrow('NOT_AUTHORIZED')
      await db.rpc(victim, 'kick_player', { p_player_id: pa.id })
      await expect(db.rpcRow(a, 'join_session', { p_pin: s.pin, p_nickname: 'A2' })).rejects.toThrow('KICKED')
      await expect(db.rpc(a, 'get_player_view', { p_session_id: s.id })).resolves.toMatchObject({ player: { status: 'kicked' } })
    })

    it('cannot tamper with scores or its own player row', async () => {
      const quiz = await quizWith(victim, [QUIZ_Q])
      const { session, player } = await liveGame(victim, quiz.id)
      for (const sql of [
        `update public.players set score = 999999 where session_id = $1`,
        `insert into public.player_answers (session_id, game_question_id, player_id, answer, points, elapsed_ms) select $1, id, id, '{}', 2000, 0 from public.game_questions limit 1`,
        `update public.game_sessions set state = 'FINAL_RESULTS' where id = $1`,
      ]) {
        await expect(db.as(player, () => db.query(sql, [session.id])), sql).rejects.toThrow(/permission denied/)
      }
    })
  })

  describe('internal functions', () => {
    it('are not callable through the API', async () => {
      const user = await db.createUser({ anonymous: true })
      for (const [fn, args] of [
        ['close_current_question', { p_session_id: ZERO }],
        ['require_profile', {}],
        ['raise_app_error', { p_code: 'X' }],
        ['check_pin_rate_limit', { p_uid: ZERO }],
        ['evaluate_answer', { p_type: 'quiz', p_content: {}, p_answer: {} }],
        ['question_solution', { p_type: 'quiz', p_content: {} }],
      ] as const) {
        await expect(db.rpc(user, fn, args), fn).rejects.toThrow(/permission denied/)
      }
    })

    it('treat hostile text as data', async () => {
      const user = await db.createUser({ anonymous: true })
      for (const pin of [`' or 1=1 --`, `123456'; drop table public.quizzes; --`, '%', '______']) {
        expect(await db.rpc(user, 'find_session', { p_pin: pin }), pin).toBeNull()
      }
      expect(await db.query('select count(*)::int as n from public.quizzes')).toEqual([{ n: expect.any(Number) }])
    })
  })
})
