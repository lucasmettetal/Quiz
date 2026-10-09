/**
 * Every failure shown to a user goes through AppError so it can be turned into
 * a human message (i18n key `errors.<code>`). Database functions raise these
 * codes verbatim (see supabase/migrations/…_game_engine.sql).
 */
export const APP_ERROR_CODES = [
  // configuration / network / generic
  'CONFIG_MISSING',
  'NETWORK',
  'NOT_FOUND',
  'NOT_AUTHORIZED',
  'NOT_AUTHENTICATED',
  'UNKNOWN',
  // auth
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'WEAK_PASSWORD',
  'EMAIL_NOT_CONFIRMED',
  'RATE_LIMITED',
  'ANONYMOUS_DISABLED',
  'EMAIL_INVALID',
  'EMAIL_SEND_FAILED',
  'SAME_PASSWORD',
  'LINK_EXPIRED',
  'LINK_INVALID',
  'LINK_OTHER_DEVICE',
  // quizzes
  'QUIZ_NOT_FOUND',
  'QUIZ_EMPTY',
  'QUIZ_INVALID',
  'QUIZ_TITLE_MISSING',
  'VERSION_CONFLICT',
  'INVALID_PAYLOAD',
  'MEDIA_INVALID',
  'MEDIA_TOO_LARGE',
  // games
  'PIN_NOT_FOUND',
  'PIN_EXHAUSTED',
  'NICKNAME_TAKEN',
  'NICKNAME_INVALID',
  'GAME_FINISHED',
  'GAME_STARTED',
  'GAME_FULL',
  'GAME_LOCKED',
  'KICKED',
  'NOT_IN_GAME',
  'NO_PLAYERS',
  'QUESTION_CLOSED',
  'ALREADY_ANSWERED',
  'TIME_UP',
  'INVALID_ANSWER',
  // import
  'KAHOOT_URL_INVALID',
  'KAHOOT_NOT_FOUND',
  'KAHOOT_PRIVATE',
  'KAHOOT_UNAVAILABLE',
  'IMPORT_EMPTY',
  'IMPORT_FILE_INVALID',
] as const

export type AppErrorCode = (typeof APP_ERROR_CODES)[number]

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause?: unknown

  constructor(code: AppErrorCode, cause?: unknown) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

const KNOWN = new Set<string>(APP_ERROR_CODES)

function messageOf(e: unknown): string {
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return ''
}

function codeOf(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && typeof e.code === 'string') return e.code
  return ''
}

function statusOf(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'status' in e && typeof e.status === 'number') return e.status
  return undefined
}

function nameOf(e: unknown): string {
  return e && typeof e === 'object' && 'name' in e && typeof e.name === 'string' ? e.name : ''
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  const message = messageOf(e)
  const code = codeOf(e)

  if (KNOWN.has(message)) return new AppError(message as AppErrorCode, e)

  // Supabase Auth (codes: https://supabase.com/docs/guides/auth/debugging/error-codes)
  const status = statusOf(e)
  if (status === 429 || code.startsWith('over_') || /rate limit|too many requests/i.test(message)) return new AppError('RATE_LIMITED', e)
  if (nameOf(e) === 'AuthRetryableFetchError') return new AppError('NETWORK', e)
  if (code === 'same_password') return new AppError('SAME_PASSWORD', e)
  if (code === 'email_address_invalid' || /invalid format|email address.*invalid/i.test(message)) return new AppError('EMAIL_INVALID', e)
  // SMTP misconfigured, or Supabase's default mailer refusing non-team addresses.
  if (code === 'email_address_not_authorized' || /error sending .*email/i.test(message)) return new AppError('EMAIL_SEND_FAILED', e)
  if (code === 'otp_expired') return new AppError('LINK_EXPIRED', e)
  if (code === 'bad_code_verifier' || code === 'flow_state_not_found') return new AppError('LINK_OTHER_DEVICE', e)
  if (code === 'session_not_found' || code === 'session_expired' || nameOf(e) === 'AuthSessionMissingError') return new AppError('LINK_INVALID', e)
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) return new AppError('INVALID_CREDENTIALS', e)
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(message)) return new AppError('EMAIL_TAKEN', e)
  if (code === 'weak_password' || /password should/i.test(message)) return new AppError('WEAK_PASSWORD', e)
  if (code === 'email_not_confirmed') return new AppError('EMAIL_NOT_CONFIRMED', e)
    if (code === 'anonymous_provider_disabled') return new AppError('ANONYMOUS_DISABLED', e)

  // PostgREST
  if (code === 'PGRST116') return new AppError('NOT_FOUND', e)
  if (code === '42501') return new AppError('NOT_AUTHORIZED', e)
  if (code === '22P02') return new AppError('NOT_FOUND', e) // malformed uuid in URL

  if (e instanceof TypeError || /failed to fetch|network|load failed/i.test(message)) return new AppError('NETWORK', e)

  return new AppError('UNKNOWN', e)
}

/** Unwraps a supabase-js `{ data, error }` result, throwing an AppError. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw toAppError(result.error)
  return result.data
}
