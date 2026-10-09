import { describe, expect, it } from 'vitest'
import { AppError, toAppError } from './errors'

// Shapes mimic supabase-js AuthError instances (name, status, code, message).
const authError = (o: { message?: string; status?: number; code?: string; name?: string }) =>
  Object.assign(new Error(o.message ?? ''), { name: o.name ?? 'AuthApiError', status: o.status, code: o.code })

describe('toAppError (auth)', () => {
  it.each([
    [{ status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }, 'RATE_LIMITED'],
    [{ status: 429, message: 'For security purposes, you can only request this after 42 seconds.' }, 'RATE_LIMITED'],
    [{ code: 'over_request_rate_limit' }, 'RATE_LIMITED'],
    [{ status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }, 'INVALID_CREDENTIALS'],
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'EMAIL_NOT_CONFIRMED'],
    [{ code: 'user_already_exists', message: 'User already registered' }, 'EMAIL_TAKEN'],
    [{ code: 'weak_password', message: 'Password should be at least 8 characters.' }, 'WEAK_PASSWORD'],
    [{ code: 'same_password' }, 'SAME_PASSWORD'],
    [{ code: 'email_address_invalid' }, 'EMAIL_INVALID'],
    [{ status: 500, code: 'unexpected_failure', message: 'Error sending recovery email' }, 'EMAIL_SEND_FAILED'],
    [{ code: 'email_address_not_authorized' }, 'EMAIL_SEND_FAILED'],
    [{ code: 'otp_expired' }, 'LINK_EXPIRED'],
    [{ name: 'AuthSessionMissingError', message: 'Auth session missing!' }, 'LINK_INVALID'],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }, 'NETWORK'],
  ])('%o → %s', (shape, code) => {
    expect(toAppError(authError(shape)).code).toBe(code)
  })

  it('maps fetch failures to NETWORK and keeps AppErrors', () => {
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('NETWORK')
    const e = new AppError('LINK_EXPIRED')
    expect(toAppError(e)).toBe(e)
  })
})
