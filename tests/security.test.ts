/**
 * Guard: the browser bundle must only ever contain public values.
 * Fails if a secret-looking value or a non-public VITE_* variable shows up in
 * the code that is shipped to browsers.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const ALLOWED_VITE_VARS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_ENABLE_GOOGLE_AUTH', 'VITE_PUBLIC_SITE_URL']

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css|html)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : []
  })
}

const shipped = [...files(join(ROOT, 'src')), join(ROOT, 'index.html'), join(ROOT, '.env.example')].map((path) => ({
  path,
  text: readFileSync(path, 'utf8'),
}))

describe('no secrets in the frontend', () => {
  it('only uses public VITE_* variables', () => {
    const used = new Set(shipped.flatMap(({ text }) => text.match(/VITE_[A-Z0-9_]+/g) ?? []))
    expect([...used].filter((v) => !ALLOWED_VITE_VARS.includes(v))).toEqual([])
  })

  it.each([
    ['JWT (service_role or any signed key)', /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\./],
    ['Resend API key', /\bre_[A-Za-z0-9]{16,}/],
    ['Stripe-like secret', /\bsk_(live|test)_[A-Za-z0-9]{10,}/],
    ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{10,}/],
    ['SMTP credentials', /SMTP_(PASS|PASSWORD|USER)|smtp_pass/i],
    ['service role key variable', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|serviceRoleKey|service_role_key/],
  ])('contains no %s', (_label, pattern) => {
    expect(shipped.filter(({ text }) => pattern.test(text)).map(({ path }) => path)).toEqual([])
  })
})
