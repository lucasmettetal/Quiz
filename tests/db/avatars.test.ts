import { beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, type TestDb } from './harness'

interface Player { id: string; avatar: string; avatar_config: Record<string, unknown> | null }

describe('avatars', () => {
  let db: TestDb
  let host: string
  let pin: string

  beforeAll(async () => {
    db = await createTestDb()
    host = await db.createUser({ name: 'Hôte' })
    const quiz = await db.as(host, async () => (await db.query<{ id: string; version: number }>(`insert into public.quizzes (title) values ('Q') returning id, version`))[0]!)
    await db.rpc(host, 'save_quiz', {
      p_quiz_id: quiz.id, p_expected_version: quiz.version, p_quiz: {},
      p_questions: [{ id: crypto.randomUUID(), type: 'true_false', prompt: 'Vrai ?', time_limit_s: 20, points: 1000, content: { correct: true } }],
    })
    pin = (await db.rpcRow<{ pin: string }>(host, 'create_game_session', { p_quiz_id: quiz.id })).pin
  })

  it('stores a sanitized avatar config when joining', async () => {
    const u = await db.createUser({ anonymous: true })
    const p = await db.rpcRow<Player>(u, 'join_session', {
      p_pin: pin,
      p_nickname: 'Zoé',
      p_avatar: 'teal',
      p_avatar_config: { v: 1, seed: 'Zoé', head: 'block', eyes: 'dots', primary: 'teal', evil: '<script>', top: 'NOT VALID!', mouth: 42 },
    })
    expect(p.avatar).toBe('teal')
    expect(p.avatar_config).toEqual({ v: 1, seed: 'Zoé', head: 'block', eyes: 'dots', primary: 'teal' })
    const view = await db.rpc<{ player: { avatar_config: unknown } }>(u, 'get_player_view', { p_session_id: (await db.query<{ session_id: string }>('select session_id from public.players where id = $1', [p.id]))[0]!.session_id })
    expect(view.player.avatar_config).toEqual(p.avatar_config)
  })

  it('stays compatible with old clients (no config)', async () => {
    const u = await db.createUser({ anonymous: true })
    const p = await db.rpcRow<Player>(u, 'join_session', { p_pin: pin, p_nickname: 'Ancien', p_avatar: 'cobalt' })
    expect(p).toMatchObject({ avatar: 'cobalt', avatar_config: null })
    // Rejoining with an avatar updates it.
    const again = await db.rpcRow<Player>(u, 'join_session', { p_pin: pin, p_nickname: 'Ancien', p_avatar: 'amber', p_avatar_config: { head: 'hex' } })
    expect(again).toMatchObject({ id: p.id, avatar: 'amber', avatar_config: { head: 'hex' } })
  })

  it('lets creators update only their own avatar, sanitized', async () => {
    const other = await db.createUser({ name: 'Autre' })
    await db.as(host, () => db.query(`update public.profiles set avatar_config = $1 where id = $2`, [JSON.stringify({ head: 'tilt', bad: 'x', primary: 'lime' }), host]))
    const [row] = await db.query<{ avatar_config: unknown }>('select avatar_config from public.profiles where id = $1', [host])
    expect(row!.avatar_config).toEqual({ head: 'tilt', primary: 'lime' })
    await db.as(other, () => db.query(`update public.profiles set avatar_config = '{"head":"hex"}' where id = $1`, [host]))
    const [unchanged] = await db.query<{ avatar_config: unknown }>('select avatar_config from public.profiles where id = $1', [host])
    expect(unchanged!.avatar_config).toEqual({ head: 'tilt', primary: 'lime' })
    // Oversized payloads are rejected by the check constraint.
    await expect(db.as(host, () => db.query(`update public.profiles set avatar_config = $1 where id = $2`, [JSON.stringify({ seed: 'x'.repeat(5000) }), host])))
      .resolves.toBeDefined() // seed > 64 chars is dropped by sanitization, so this is accepted…
    const [after] = await db.query<{ avatar_config: Record<string, unknown> }>('select avatar_config from public.profiles where id = $1', [host])
    expect(after!.avatar_config.seed).toBeUndefined() // …without storing the oversized value
  })
})
