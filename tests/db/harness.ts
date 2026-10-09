/**
 * Runs the real Supabase migrations inside PGlite (Postgres compiled to WASM)
 * with a minimal shim of what Supabase provides (auth schema, roles), so RLS
 * policies and RPC functions can be tested without Docker or a cloud project.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

const MIGRATIONS_DIR = join(import.meta.dirname, '../../supabase/migrations')

const SUPABASE_SHIM = /* sql */ `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create schema extensions;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    is_anonymous boolean not null default false,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth, extensions to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
`

export type Uid = string | null

export class TestDb {
  constructor(readonly pg: PGlite) {}

  async createUser(opts: { name?: string; email?: string; anonymous?: boolean } = {}): Promise<string> {
    const res = await this.pg.query<{ id: string }>(
      `insert into auth.users (email, is_anonymous, raw_user_meta_data) values ($1, $2, $3) returning id`,
      [opts.anonymous ? null : (opts.email ?? `${opts.name ?? 'user'}-${Math.random()}@test.dev`), !!opts.anonymous,
        JSON.stringify(opts.name ? { display_name: opts.name } : {})],
    )
    return res.rows[0]!.id
  }

  /** Run queries as a given user (null = the anon role, like a signed-out visitor). */
  async as<T>(uid: Uid, fn: () => Promise<T>): Promise<T> {
    await this.pg.exec(uid ? `set role authenticated` : `set role anon`)
    await this.pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
    try {
      return await fn()
    } finally {
      await this.pg.exec(`reset role`)
      await this.pg.query(`select set_config('request.jwt.claim.sub', '', false)`)
    }
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return (await this.pg.query<T>(sql, params)).rows
  }

  /** Call `public.<fn>` with named arguments, as `uid`. Objects are sent as jsonb. */
  rpc<T = unknown>(uid: Uid, fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const [call, params] = namedCall(args)
    return this.as(uid, async () => {
      const rows = await this.query<{ result: T }>(`select public.${fn}(${call}) as result`, params)
      return rows[0]!.result
    })
  }

  /** Like rpc(), for functions returning a table row (composite type). */
  rpcRow<T = Record<string, unknown>>(uid: Uid, fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const [call, params] = namedCall(args)
    return this.as(uid, async () => (await this.query<T>(`select * from public.${fn}(${call})`, params))[0]!)
  }
}

function namedCall(args: Record<string, unknown>): [string, unknown[]] {
  const names = Object.keys(args)
  const params = names.map((n) => {
    const v = args[n]
    return v !== null && typeof v === 'object' ? JSON.stringify(v) : v
  })
  return [names.map((n, i) => `${n} => $${i + 1}`).join(', '), params]
}

export async function createTestDb(): Promise<TestDb> {
  const pg = await PGlite.create({ extensions: { pg_trgm } })
  await pg.exec(SUPABASE_SHIM)
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !f.includes('storage')).sort()
  for (const file of files) {
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
  }
  return new TestDb(pg)
}
