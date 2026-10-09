/**
 * Auth e-mail links: where Supabase sends users back, and how we read what
 * comes back. Pure helpers (no Supabase client) so they are unit-tested.
 *
 * Redirect base = VITE_PUBLIC_SITE_URL when set (custom domain), otherwise the
 * current origin: localhost in dev, the Vercel domain in production, a future
 * domain without code changes. Every URL built here must also be listed in
 * Supabase → Authentication → URL Configuration → Redirect URLs.
 */
import type { AppErrorCode } from '@/lib/errors'

export const AUTH_ROUTES = {
  callback: '/auth/callback',
  reset: '/auth/reset',
  forgot: '/auth/forgot',
  login: '/auth/login',
} as const

export function authRedirectUrl(path: string, opts: { siteUrl?: string; origin?: string } = {}): string {
  const base = (opts.siteUrl || opts.origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export type AuthRedirect =
  | { kind: 'error'; code: string; description: string }
  | { kind: 'code'; code: string }
  | { kind: 'token_hash'; tokenHash: string; type: string }
  | { kind: 'none' }

/**
 * Reads what Supabase put in the URL. Errors may arrive in the query string
 * or in the hash (`#error=access_denied&error_code=otp_expired…`).
 */
export function parseAuthRedirect(href: string): AuthRedirect {
  const url = new URL(href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const get = (k: string) => url.searchParams.get(k) ?? hash.get(k)
  const error = get('error') ?? get('error_code')
  if (error) return { kind: 'error', code: get('error_code') ?? error, description: get('error_description') ?? '' }
  const code = url.searchParams.get('code')
  if (code) return { kind: 'code', code }
  const tokenHash = get('token_hash')
  if (tokenHash) return { kind: 'token_hash', tokenHash, type: get('type') ?? 'email' }
  return { kind: 'none' }
}

/** Translates Supabase link failures into messages a person can act on. */
export function linkErrorCode(code: string | undefined, description = '', status?: number): AppErrorCode {
  const c = (code ?? '').toLowerCase()
  const d = description.toLowerCase()
  if (status === 429 || c.startsWith('over_') || /rate limit|too many/.test(d)) return 'RATE_LIMITED'
  // PKCE: the code verifier lives in the browser that asked for the e-mail.
  if (c === 'bad_code_verifier' || c === 'flow_state_not_found' || /code verifier|flow state/.test(d)) return 'LINK_OTHER_DEVICE'
  if (c === 'otp_expired' || c === 'flow_state_expired' || /expired/.test(d)) return 'LINK_EXPIRED'
  if (status === 0 || c === 'network') return 'NETWORK'
  return 'LINK_INVALID'
}

/** Removes auth parameters from the address bar once handled (no re-use on refresh, nothing left in history). */
export function cleanAuthParams(href: string): string {
  const url = new URL(href)
  for (const k of ['code', 'error', 'error_code', 'error_description', 'token_hash', 'type']) url.searchParams.delete(k)
  url.hash = ''
  return url.pathname + url.search
}

/*
 * Recovery marker: /auth/reset only lets someone set a new password when the
 * session was opened by a recovery link *in this tab* — not with any session
 * that happens to exist (a signed-in creator uses Settings instead).
 */
const RECOVERY_KEY = 'tilt.recovery'

export function markRecovery(userId: string) {
  try {
    sessionStorage.setItem(RECOVERY_KEY, userId)
  } catch {
    /* private mode: the page still works for this load */
  }
}

export function hasRecovery(userId: string): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === userId
  } catch {
    return false
  }
}

export function clearRecovery() {
  try {
    sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    /* ignore */
  }
}
