/**
 * Security hardening (supabase/migrations/20261012000500_security_hardening.sql).
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'

const QUESTION = {
  type: 'quiz', prompt: 'Capitale de la France ?', time_limit_s: 20, points: 1000,
  content: { options: [{ id: 'a', text: 'Paris', correct: true }, { id: 'b', text: 'Lyon', correct: false }] },
}

async function newQuiz(db: TestDb, owner: string) {
  return db.as(owner, async () => (await db.query<{ id: string; version: number }>(
    `insert into public.quizzes (title) values ('Quiz') returning id, version`))[0]!)
}

async function save(db: TestDb, owner: string, quiz: { id: string; version: number }, quizPatch: object, questions: object[]) {
  const version = await db.rpc<number>(owner, 'save_quiz', {
    p_quiz_id: quiz.id, p_expected_version: quiz.version, p_quiz: quizPatch,
    p_questions: questions.map((q) => ({ ...q, id: crypto.randomUUID() })),
  })
  quiz.version = version
  return version
}

describe('security hardening (PostgreSQL)', () => {
  let db: TestDb
  let owner: string

  beforeAll(async () => {
    db = await createTestDb()
    owner = await db.createUser({ name: 'Créatrice' })
  })

  it('publication state only changes through publish_quiz', async () => {
    const quiz = await newQuiz(db, owner)
    await expect(db.as(owner, () => db.query(`update public.quizzes set status = 'published', visibility = 'public' where id = $1`, [quiz.id])))
      .rejects.toThrow(/permission denied/)
    await expect(db.as(owner, () => db.query(`insert into public.quizzes (title, status, visibility) values ('X', 'published', 'public')`)))
      .rejects.toThrow(/permission denied/)
    // Allowed columns still work.
    await db.as(owner, () => db.query(`update public.quizzes set title = 'Nouveau titre' where id = $1`, [quiz.id]))
  })

  it('only accepts media from the bucket or Kahoot, and bounded payloads', async () => {
    const quiz = await newQuiz(db, owner)
    await save(db, owner, quiz, {}, [{ ...QUESTION, media: { path: `${owner}/${crypto.randomUUID()}.webp` } }])
    await save(db, owner, quiz, {}, [{ ...QUESTION, media: { path: 'https://images-cdn.kahoot.it/abc.jpg' } }])

    await expect(save(db, owner, quiz, {}, [{ ...QUESTION, media: { path: 'https://tracker.example/pixel.gif' } }]))
      .rejects.toThrow(/questions_media_path/)
    await expect(save(db, owner, quiz, {}, [{ ...QUESTION, media: { path: 'https://kahoot.it.evil.example/a.png' } }]))
      .rejects.toThrow(/questions_media_path/)
    await expect(save(db, owner, quiz, { cover_image_path: 'https://tracker.example/c.png' }, [QUESTION]))
      .rejects.toThrow(/quizzes_cover_image_path/)

    // Random text does not compress: this payload really is larger than 32 kB.
    const noise = Array.from({ length: 6000 }, () => crypto.randomUUID().slice(0, 8)).join('')
    await expect(save(db, owner, quiz, {}, [{ ...QUESTION, content: { ...QUESTION.content, filler: noise } }]))
      .rejects.toThrow(/questions_content_size/)
  })

  it('needs an identity to look up a PIN and rate-limits misses', async () => {
    await expect(db.rpc(null, 'find_session', { p_pin: '123456' })).rejects.toThrow(/permission denied/)

    const quiz = await newQuiz(db, owner)
    await save(db, owner, quiz, {}, [QUESTION])
    const session = await db.rpcRow<{ pin: string }>(owner, 'create_game_session', { p_quiz_id: quiz.id })

    const guesser = await db.createUser({ anonymous: true })
    const wrong = session.pin === '100000' ? '100001' : '100000'
    for (let i = 0; i < 10; i++) expect(await db.rpc(guesser, 'find_session', { p_pin: wrong })).toBeNull()
    for (let i = 0; i < 10; i++) {
      expect((await db.rpcRow<{ id: string | null }>(guesser, 'join_session', { p_pin: wrong, p_nickname: 'X' })).id).toBeNull()
    }
    // 20 misses: even the right PIN is refused for now, through both entry points.
    await expect(db.rpc(guesser, 'find_session', { p_pin: session.pin })).rejects.toThrow('RATE_LIMITED')
    await expect(db.rpcRow(guesser, 'join_session', { p_pin: session.pin, p_nickname: 'X' })).rejects.toThrow('RATE_LIMITED')

    // Other users are not affected, and nobody can read or call the internals.
    const honest = await db.createUser({ anonymous: true })
    expect(await db.rpc(honest, 'find_session', { p_pin: session.pin })).toMatchObject({ reason: null })
    await expect(db.as(guesser, () => db.query('select * from public.pin_lookup_misses'))).rejects.toThrow(/permission denied/)
    await expect(db.rpc(guesser, 'check_pin_rate_limit', { p_uid: honest })).rejects.toThrow(/permission denied/)

    // Misses older than the window no longer count.
    await db.query(`update public.pin_lookup_misses set at = now() - interval '11 minutes' where user_id = $1`, [guesser])
    expect(await db.rpc(guesser, 'find_session', { p_pin: session.pin })).toMatchObject({ reason: null })
  })

  it('caps the number of live games per host', async () => {
    const host = await db.createUser({ name: 'Hôte' })
    const quiz = await newQuiz(db, host)
    await save(db, host, quiz, {}, [QUESTION])
    const sessions = []
    for (let i = 0; i < 10; i++) sessions.push(await db.rpcRow<{ id: string }>(host, 'create_game_session', { p_quiz_id: quiz.id }))
    await expect(db.rpcRow(host, 'create_game_session', { p_quiz_id: quiz.id })).rejects.toThrow('TOO_MANY_GAMES')

    // Ending a game frees a slot.
    await db.rpc(host, 'host_end_game', { p_session_id: sessions[0]!.id })
    await db.rpcRow(host, 'create_game_session', { p_quiz_id: quiz.id })
  })
})
