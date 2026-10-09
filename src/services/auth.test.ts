import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake Supabase client: records calls, never reaches the network or an SMTP server.
const auth = {
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ auth }) }))

const { completeAuthRedirect, resendSignupConfirmation, sendPasswordReset, signOut, signUp } = await import('./auth')

const origin = window.location.origin
const session = { user: { id: 'u1' } }

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session } })
  window.history.replaceState(null, '', '/')
})

describe('redirect URLs sent to Supabase', () => {
  it('password reset comes back to /auth/reset on the current origin', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null })
    await sendPasswordReset('lea@example.fr')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('lea@example.fr', { redirectTo: `${origin}/auth/reset` })
  })

  it('sign-up confirmation comes back to /auth/callback with the flow marker', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null })
    await expect(signUp({ email: 'a@b.fr', password: 'motdepasse', displayName: 'Léa', locale: 'fr' })).resolves.toBe(false)
    expect(auth.signUp.mock.calls[0]![0].options.emailRedirectTo).toBe(`${origin}/auth/callback?flow=signup`)
  })

  it('resend uses the same confirmation URL', async () => {
    auth.resend.mockResolvedValue({ error: null })
    await resendSignupConfirmation('a@b.fr')
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.fr', options: { emailRedirectTo: `${origin}/auth/callback?flow=signup` } })
  })

  it('reports an already used e-mail (obfuscated user without identities)', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null })
    await expect(signUp({ email: 'a@b.fr', password: 'motdepasse', displayName: 'Léa', locale: 'fr' })).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
  })

  it('maps a 429 from the mailer to a friendly rate-limit error', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: Object.assign(new Error('email rate limit exceeded'), { status: 429, code: 'over_email_send_rate_limit' }) })
    await expect(sendPasswordReset('a@b.fr')).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })
})

describe('completeAuthRedirect', () => {
  it('exchanges a PKCE code once and cleans the URL', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null })
    const href = `${origin}/auth/reset?code=abc`
    window.history.replaceState(null, '', '/auth/reset?code=abc')
    const [a, b] = await Promise.all([completeAuthRedirect(href), completeAuthRedirect(href)])
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
    expect(a).toEqual({ fromLink: true, session })
    expect(b.fromLink).toBe(true)
    expect(window.location.search).toBe('')
  })

  it('explains a link opened in another browser', async () => {
    auth.exchangeCodeForSession.mockResolvedValue({
      error: Object.assign(new Error('invalid request: both auth code and code verifier should be non-empty'), { status: 400, code: 'validation_failed' }),
    })
    await expect(completeAuthRedirect(`${origin}/auth/reset?code=other-device`)).rejects.toMatchObject({ code: 'LINK_OTHER_DEVICE' })
  })

  it('explains an expired link sent back as an error', async () => {
    await expect(completeAuthRedirect(`${origin}/auth/reset#error=access_denied&error_code=otp_expired`)).rejects.toMatchObject({ code: 'LINK_EXPIRED' })
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('without a link, just reports the current session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(completeAuthRedirect(`${origin}/auth/reset`)).resolves.toEqual({ fromLink: false, session: null })
  })
})

describe('signOut', () => {
  it('forgets the local session when the server is unreachable', async () => {
    auth.signOut.mockResolvedValueOnce({ error: new Error('Failed to fetch') }).mockResolvedValueOnce({ error: null })
    await signOut()
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: 'local' })
  })
})
