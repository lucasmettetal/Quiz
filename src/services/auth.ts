import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { profileSchema, type Profile } from '@/types/database'
import type { Locale } from '@/i18n/translate'
import type { PaletteColor } from '@/lib/palette'

const redirect = (path: string) => `${window.location.origin}${path}`

export async function signInWithPassword(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw toAppError(error)
}

/** Returns true when the session is immediately active (no email confirmation required). */
export async function signUp(input: { email: string; password: string; displayName: string; locale: Locale }) {
  const { data, error } = await getSupabase().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { display_name: input.displayName, locale: input.locale },
      emailRedirectTo: redirect('/auth/callback'),
    },
  })
  if (error) throw toAppError(error)
  // Supabase hides existing accounts by returning a user without identities.
  if (data.user && data.user.identities?.length === 0) throw new AppError('EMAIL_TAKEN')
  return Boolean(data.session)
}

export async function signInWithGoogle(next = '/app') {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirect(`/auth/callback?next=${encodeURIComponent(next)}`) },
  })
  if (error) throw toAppError(error)
}

export async function sendPasswordReset(email: string) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: redirect('/auth/reset') })
  if (error) throw toAppError(error)
}

export async function updatePassword(password: string) {
  const { error } = await getSupabase().auth.updateUser({ password })
  if (error) throw toAppError(error)
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw toAppError(error)
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
