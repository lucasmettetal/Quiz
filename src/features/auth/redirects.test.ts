import { describe, expect, it } from 'vitest'
import { authRedirectUrl, cleanAuthParams, linkErrorCode, parseAuthRedirect } from './redirects'

describe('authRedirectUrl', () => {
  it('uses the current origin by default (localhost, Vercel, custom domain alike)', () => {
    expect(authRedirectUrl('/auth/reset', { origin: 'http://localhost:5173' })).toBe('http://localhost:5173/auth/reset')
    expect(authRedirectUrl('/auth/reset', { origin: 'https://quiz-black-one-92.vercel.app' })).toBe('https://quiz-black-one-92.vercel.app/auth/reset')
    expect(authRedirectUrl('/auth/callback?flow=signup')).toBe(`${window.location.origin}/auth/callback?flow=signup`)
  })
  it('prefers an explicit public site URL and tolerates a trailing slash', () => {
    expect(authRedirectUrl('/auth/reset', { siteUrl: 'https://tilt.example/', origin: 'http://localhost:5173' })).toBe('https://tilt.example/auth/reset')
    expect(authRedirectUrl('auth/callback', { origin: 'https://a.b' })).toBe('https://a.b/auth/callback')
  })
})

describe('parseAuthRedirect', () => {
  it('reads PKCE codes, token hashes and nothing', () => {
    expect(parseAuthRedirect('https://x.app/auth/reset?code=abc')).toEqual({ kind: 'code', code: 'abc' })
    expect(parseAuthRedirect('https://x.app/auth/reset?token_hash=th&type=recovery')).toEqual({ kind: 'token_hash', tokenHash: 'th', type: 'recovery' })
    expect(parseAuthRedirect('https://x.app/auth/reset')).toEqual({ kind: 'none' })
  })
  it('reads errors from the query string or the hash', () => {
    expect(parseAuthRedirect('https://x.app/auth/reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toEqual({
      kind: 'error',
      code: 'otp_expired',
      description: 'Email link is invalid or has expired',
    })
    expect(parseAuthRedirect('https://x.app/auth/callback?error=server_error&error_description=boom')).toMatchObject({ kind: 'error', code: 'server_error' })
  })
})

describe('linkErrorCode', () => {
  it('turns Supabase failures into actionable messages', () => {
    expect(linkErrorCode('otp_expired')).toBe('LINK_EXPIRED')
    expect(linkErrorCode('flow_state_expired')).toBe('LINK_EXPIRED')
    expect(linkErrorCode('bad_code_verifier')).toBe('LINK_OTHER_DEVICE')
    expect(linkErrorCode('validation_failed', 'invalid request: both auth code and code verifier should be non-empty')).toBe('LINK_OTHER_DEVICE')
    expect(linkErrorCode('flow_state_not_found')).toBe('LINK_OTHER_DEVICE')
    expect(linkErrorCode('over_email_send_rate_limit')).toBe('RATE_LIMITED')
    expect(linkErrorCode(undefined, '', 429)).toBe('RATE_LIMITED')
    expect(linkErrorCode('access_denied', 'whatever')).toBe('LINK_INVALID')
  })
})

describe('cleanAuthParams', () => {
  it('drops auth parameters but keeps the rest', () => {
    expect(cleanAuthParams('https://x.app/auth/callback?code=abc&next=%2Fapp%2Fquizzes#error=x')).toBe('/auth/callback?next=%2Fapp%2Fquizzes')
    expect(cleanAuthParams('https://x.app/auth/reset?code=abc')).toBe('/auth/reset')
  })
})
