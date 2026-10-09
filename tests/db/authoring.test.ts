import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'

const question = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(), type: 'true_false', prompt: 'La Terre est ronde', time_limit_s: 20, points: 1000,
  content: { correct: true }, ...over,
})

describe('quiz authoring & RLS', () => {
  let db: TestDb
  let alice: string
  let bob: string

  beforeAll(async () => {
    db = await createTestDb()
    alice = await db.createUser({ name: 'Alice' })
    bob = await db.createUser({ name: 'Bob' })
  })

  const newQuiz = (uid: string, title = 'Mon quiz') =>
    db.as(uid, async () => (await db.query<{ id: string; version: number }>(
      'insert into public.quizzes (title) values ($1) returning id, version', [title]))[0]!)

  it('creates profiles for registered users only', async () => {
    const anon = await db.createUser({ anonymous: true })
    const rows = await db.query<{ id: string; display_name: string }>('select id, display_name from public.profiles')
    expect(rows.map((r) => r.id)).toContain(alice)
    expect(rows.map((r) => r.id)).not.toContain(anon)
    expect(rows.find((r) => r.id === alice)!.display_name).toBe('Alice')
    // Anonymous players cannot create quizzes (no profile).
    await expect(db.as(anon, () => db.query(`insert into public.quizzes (title) values ('x')`))).rejects.toThrow()
  })

  it('isolates private quizzes and exposes published public ones', async () => {
    const q = await newQuiz(alice, 'Secret')
    expect(await db.as(bob, () => db.query('select id from public.quizzes where id = $1', [q.id]))).toHaveLength(0)
    expect(await db.as(null, () => db.query('select id from public.quizzes where id = $1', [q.id]))).toHaveLength(0)

    // Bob cannot modify or delete it.
    await db.as(bob, () => db.query(`update public.quizzes set title = 'hack' where id = $1`, [q.id]))
    await db.as(bob, () => db.query('delete from public.quizzes where id = $1', [q.id]))
    const [still] = await db.query<{ title: string }>('select title from public.quizzes where id = $1', [q.id])
    expect(still!.title).toBe('Secret')

    // Cannot be public without being published (constraint).
    await expect(db.as(alice, () => db.query(`update public.quizzes set visibility = 'public' where id = $1`, [q.id])))
      .rejects.toThrow()

    await db.rpc(alice, 'save_quiz', { p_quiz_id: q.id, p_expected_version: q.version, p_quiz: {}, p_questions: [question()] })
    await db.rpcRow(alice, 'publish_quiz', { p_quiz_id: q.id, p_visibility: 'public' })
    expect(await db.as(null, () => db.query('select id from public.quizzes where id = $1', [q.id]))).toHaveLength(1)
    expect(await db.as(bob, () => db.query('select id from public.questions where quiz_id = $1', [q.id]))).toHaveLength(1)
    // Author name becomes visible with the public quiz.
    expect(await db.as(bob, () => db.query('select display_name from public.profiles where id = $1', [alice]))).toHaveLength(1)
  })

  it('cannot set ownership or protected columns directly', async () => {
    await expect(db.as(bob, () => db.query(`insert into public.quizzes (title, owner_id) values ('x', $1)`, [alice])))
      .rejects.toThrow()
    const q = await newQuiz(bob)
    await expect(db.as(bob, () => db.query('update public.quizzes set play_count = 999 where id = $1', [q.id])))
      .rejects.toThrow()
  })

  it('autosaves the whole question list atomically with version checks', async () => {
    const q = await newQuiz(alice)
    const q1 = question({ prompt: 'Un' })
    const q2 = question({ prompt: 'Deux' })
    const v2 = await db.rpc<number>(alice, 'save_quiz', {
      p_quiz_id: q.id, p_expected_version: q.version, p_quiz: { title: 'Renommé', tags: ['Histoire', 'histoire', 'xx'] },
      p_questions: [q1, q2],
    })
    expect(v2).toBe(q.version + 1)

    // Reorder + delete + add in one call.
    const q3 = question({ prompt: 'Trois' })
    await db.rpc(alice, 'save_quiz', { p_quiz_id: q.id, p_expected_version: v2, p_quiz: {}, p_questions: [q3, q2] })
    const rows = await db.query<{ prompt: string; position: number }>(
      'select prompt, position from public.questions where quiz_id = $1 order by position', [q.id])
    expect(rows).toEqual([{ prompt: 'Trois', position: 0 }, { prompt: 'Deux', position: 1 }])
    const [meta] = await db.query<{ title: string; question_count: number }>(
      'select title, question_count from public.quizzes where id = $1', [q.id])
    expect(meta).toEqual({ title: 'Renommé', question_count: 2 })
    const tags = await db.query<{ tag: string }>('select tag from public.quiz_tags where quiz_id = $1 order by tag', [q.id])
    expect(tags.map((t) => t.tag)).toEqual(['histoire', 'xx'])

    // A stale editor (other tab) gets a conflict instead of overwriting.
    await expect(db.rpc(alice, 'save_quiz', { p_quiz_id: q.id, p_expected_version: v2, p_quiz: {}, p_questions: [] }))
      .rejects.toThrow('VERSION_CONFLICT')
    // Someone else cannot save into it.
    await expect(db.rpc(bob, 'save_quiz', { p_quiz_id: q.id, p_expected_version: v2 + 1, p_quiz: {}, p_questions: [] }))
      .rejects.toThrow('QUIZ_NOT_FOUND')
  })

  it('refuses to hijack a question belonging to another quiz', async () => {
    const a = await newQuiz(alice)
    const victim = question({ prompt: 'Original' })
    await db.rpc(alice, 'save_quiz', { p_quiz_id: a.id, p_expected_version: a.version, p_quiz: {}, p_questions: [victim] })
    const b = await newQuiz(bob)
    await db.rpc(bob, 'save_quiz', {
      p_quiz_id: b.id, p_expected_version: b.version, p_quiz: {}, p_questions: [{ ...victim, prompt: 'Volé' }],
    })
    const [row] = await db.query<{ prompt: string; quiz_id: string }>('select prompt, quiz_id from public.questions where id = $1', [victim.id])
    expect(row).toEqual({ prompt: 'Original', quiz_id: a.id })
  })

  it('validates before publishing', async () => {
    const q = await newQuiz(alice, 'Incomplet')
    await expect(db.rpcRow(alice, 'publish_quiz', { p_quiz_id: q.id, p_visibility: 'public' })).rejects.toThrow('QUIZ_EMPTY')
    await db.rpc(alice, 'save_quiz', {
      p_quiz_id: q.id, p_expected_version: q.version, p_quiz: {},
      p_questions: [question({ type: 'quiz', content: { options: [{ id: 'a', text: '', correct: true }] } })],
    })
    await expect(db.rpcRow(alice, 'publish_quiz', { p_quiz_id: q.id, p_visibility: 'public' })).rejects.toThrow('QUIZ_INVALID')
    const issues = await db.rpc<string[]>(null, 'question_issues', {
      p_type: 'quiz', p_prompt: '', p_content: { options: [{ id: 'a', text: '', correct: false }] },
    })
    expect(issues).toEqual(['prompt_empty', 'options_count', 'option_empty', 'no_correct'])
  })

  it('duplicates public quizzes into the caller library', async () => {
    const q = await newQuiz(alice, 'À copier')
    await db.rpc(alice, 'save_quiz', { p_quiz_id: q.id, p_expected_version: q.version, p_quiz: { tags: ['geo'] }, p_questions: [question(), question()] })
    await expect(db.rpc(bob, 'duplicate_quiz', { p_quiz_id: q.id, p_title: 'Copie' })).rejects.toThrow('QUIZ_NOT_FOUND')
    await db.rpcRow(alice, 'publish_quiz', { p_quiz_id: q.id, p_visibility: 'unlisted' })
    const copyId = await db.rpc<string>(bob, 'duplicate_quiz', { p_quiz_id: q.id, p_title: 'Ma copie' })
    const [copy] = await db.as(bob, () => db.query<Record<string, unknown>>('select * from public.quizzes where id = $1', [copyId]))
    expect(copy).toMatchObject({ owner_id: bob, title: 'Ma copie', status: 'draft', visibility: 'private', forked_from: q.id, question_count: 2 })
  })

  it('keeps favorites personal', async () => {
    const q = await newQuiz(alice)
    await db.as(alice, () => db.query('insert into public.favorites (quiz_id) values ($1)', [q.id]))
    expect(await db.as(bob, () => db.query('select * from public.favorites'))).toHaveLength(0)
    // Bob cannot favorite a quiz he cannot see.
    await expect(db.as(bob, () => db.query('insert into public.favorites (quiz_id) values ($1)', [q.id]))).rejects.toThrow()
  })

  it('hides live games from outsiders', async () => {
    const q = await newQuiz(alice)
    await db.rpc(alice, 'save_quiz', { p_quiz_id: q.id, p_expected_version: q.version, p_quiz: {}, p_questions: [question()] })
    const s = await db.rpcRow<{ id: string; pin: string }>(alice, 'create_game_session', { p_quiz_id: q.id })
    const stranger = await db.createUser({ anonymous: true })
    expect(await db.as(stranger, () => db.query('select * from public.game_sessions where id = $1', [s.id]))).toHaveLength(0)
    expect(await db.as(stranger, () => db.query('select * from public.game_questions where session_id = $1', [s.id]))).toHaveLength(0)
    await db.rpcRow(stranger, 'join_session', { p_pin: s.pin, p_nickname: 'Max' })
    expect(await db.as(stranger, () => db.query('select * from public.game_sessions where id = $1', [s.id]))).toHaveLength(1)
    // Even as a player, questions (with answers) stay hidden.
    expect(await db.as(stranger, () => db.query('select * from public.game_questions where session_id = $1', [s.id]))).toHaveLength(0)
    expect(await db.as(stranger, () => db.query('select * from public.players where session_id = $1', [s.id]))).toHaveLength(1)
    await expect(db.as(stranger, () => db.query(`update public.players set score = 99999 where session_id = $1`, [s.id])))
      .rejects.toThrow()

    // Only the host can delete the game.
    await db.as(stranger, () => db.query('delete from public.game_sessions where id = $1', [s.id]))
    expect(await db.query('select id from public.game_sessions where id = $1', [s.id])).toHaveLength(1)
    await db.as(alice, () => db.query('delete from public.game_sessions where id = $1', [s.id]))
    expect(await db.query('select id from public.players where session_id = $1', [s.id])).toHaveLength(0)
  })
})
