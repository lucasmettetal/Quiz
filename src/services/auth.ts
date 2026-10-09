/**
 * Supabase Auth calls. E-mails (confirmation, password reset) are sent by
 * Supabase through the SMTP server configured in the Supabase dashboard:
 * the browser never holds SMTP credentials and never sends e-mail itself.
 */
import type { Session } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { env } from '@/lib/env'
import { AUTH_ROUTES, authRedirectUrl, cleanAuthParams, linkErrorCode, parseAuthRedirect } from '@/features/auth/redirects'
import { profileSchema, type Profile } from '@/types/database'
import type { Locale } from '@/i18n/translate'
import type { PaletteColor } from '@/lib/palette'

const redirect = (path: string) => authRedirectUrl(path, { siteUrl: env.siteUrl })

/** Where the confirmation e-mail sends people back (flow=signup lets the callback page word things right). */
export const signupRedirectUrl = () => redirect(`${AUTH_ROUTES.callback}?flow=signup`)
export const resetRedirectUrl = () => redirect(AUTH_ROUTES.reset)
export const oauthRedirectUrl = (next: string) => redirect(`${AUTH_ROUTES.callback}?next=${encodeURIComponent(next)}`)

export async function signInWithPassword(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw toAppError(error)
}

/** Returns true when the session is immediately active (e-mail confirmation disabled). */
export async function signUp(input: { email: string; password: string; displayName: string; locale: Locale }) {
  const { data, error } = await getSupabase().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName, locale: input.locale },
      emailRedirectTo: signupRedirectUrl(),
    },
  })
  if (error) throw toAppError(error)
  // With confirmations on, Supabase hides existing accounts by returning a user without identities.
  if (data.user && data.user.identities?.length === 0) throw new AppError('EMAIL_TAKEN')
  return Boolean(data.session)
}

export async function resendSignupConfirmation(email: string) {
  const { error } = await getSupabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: signupRedirectUrl() } })
  if (error) throw toAppError(error)
}

export async function signInWithGoogle(next = '/app') {
  const { error } = await getSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: oauthRedirectUrl(next) } })
  if (error) throw toAppError(error)
}

export async function sendPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: resetRedirectUrl() })
  if (error) throw toAppError(error)
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password })
  if (error) throw toAppError(error)
}

/** Signs out; if the server can't be reached, still forgets the session on this device. */
export async function signOut() {
  const supabase = getSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) await supabase.auth.signOut({ scope: 'local' })
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await getSupabase().auth.getSession()
  return data.session
}

/* --------------------------------------------------- e-mail link handling */

// One exchange per code: React StrictMode (and double mounts) must not spend a PKCE code twice.
const exchanges = new Map<string, Promise<void>>()

export interface AuthRedirectResult {
  /** A session was just created from the link in the URL. */
  fromLink: boolean
  session: Session | null
}

/**
 * Completes the auth step encoded in the current URL (PKCE `code`, `token_hash`
 * or an error sent by Supabase), cleans the address bar, and returns the session.
 * Throws an AppError with a link-specific code (LINK_EXPIRED, LINK_OTHER_DEVICE…).
 */
export async function completeAuthRedirect(href = window.location.href): Promise<AuthRedirectResult> {
  const supabase = getSupabase()
  const parsed = parseAuthRedirect(href)
  const clean = () => window.history.replaceState(window.history.state, '', cleanAuthParams(href))

  if (parsed.kind === 'error') {
    clean()
    throw new AppError(linkErrorCode(parsed.code, parsed.description))
  }

  if (parsed.kind === 'code') {
    let pending = exchanges.get(parsed.code)
    if (!pending) {
      pending = supabase.auth.exchangeCodeForSession(parsed.code).then(({ error }) => {
        if (error) throw new AppError(linkErrorCode(error.code, error.message, error.status), error)
      })
      exchanges.set(parsed.code, pending)
    }
    try {
      await pending
    } finally {
      clean()
    }
    return { fromLink: true, session: await getCurrentSession() }
  }

  if (parsed.kind === 'token_hash') {
    // Custom e-mail templates may use {{ .TokenHash }} instead of the PKCE redirect.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: parsed.tokenHash,
      type: parsed.type === 'recovery' ? 'recovery' : parsed.type === 'email_change' ? 'email_change' : 'email',
    })
    clean()
    if (error) throw new AppError(linkErrorCode(error.code, error.message, error.status), error)
    return { fromLink: true, session: await getCurrentSession() }
  }

  return { fromLink: false, session: await getCurrentSession() }
}

/* ------------------------------------------------------------- profiles */

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw toAppError(error)
  return data ? profileSchema.parse(data) : null
}

export async function updateProfile(
  userId: string,
  patch: Partial<{ display_name: string; avatar_color: PaletteColor; locale: Locale }>,
): Promise<Profile> {
  const { data, error } = await getSupabase().from('profiles').update(patch).eq('id', userId).select('*').single()
  if (error) throw toAppError(error)
  return profileSchema.parse(data)
}

/**
 * Players need an identity for RLS and reconnection but no account: reuse the
 * current session (anonymous or not) or create an anonymous one.
 */
export async function ensurePlayerIdentity(): Promise<string> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user.id
  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signedIn.user) throw toAppError(error ?? new Error('anonymous sign-in failed'))
  return signedIn.user.id
}
