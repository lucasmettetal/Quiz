import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '@/i18n/I18nProvider'
import { parseRateLimit, toAppError } from '@/lib/errors'

const sendPasswordReset = vi.fn()
vi.mock('@/services/auth', () => ({ sendPasswordReset }))
const { ForgotPasswordPage } = await import('./ForgotPasswordPage')

// What supabase-js returns for the two Supabase limits (status 429).
const perAddress = (s: number) =>
  toAppError(Object.assign(new Error(`For security purposes, you can only request this after ${s} seconds.`), { status: 429, code: 'over_email_send_rate_limit' }))
const hourly = () => toAppError(Object.assign(new Error('email rate limit exceeded'), { status: 429, code: 'over_email_send_rate_limit' }))

describe('parseRateLimit', () => {
  it('tells apart the per-address wait and the hourly cap', () => {
    expect(parseRateLimit('For security purposes, you can only request this after 42 seconds.')).toEqual({ scope: 'user', retryAfterSeconds: 42 })
    expect(parseRateLimit('email rate limit exceeded')).toEqual({ scope: 'project', retryAfterSeconds: null })
    expect(parseRateLimit('Too many requests')).toEqual({ scope: 'unknown', retryAfterSeconds: null })
    expect(perAddress(7).rateLimit).toEqual({ scope: 'user', retryAfterSeconds: 7 })
  })
})

describe('/auth/forgot rate limits', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    sendPasswordReset.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  async function submit() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(
      <I18nProvider locale="fr">
        <MemoryRouter>
          <ForgotPasswordPage />
        </MemoryRouter>
      </I18nProvider>,
    )
    await user.type(screen.getByLabelText('E-mail'), 'lea@example.fr')
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
    return user
  }

  it('shows a live countdown for the per-address limit, then lets the user retry', async () => {
    sendPasswordReset.mockRejectedValueOnce(perAddress(3))
    await submit()
    expect(await screen.findByText(/une seule demande est possible par minute.*3\ss/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Réessayer dans 3/ })).toBeDisabled()
    await act(() => vi.advanceTimersByTimeAsync(1100))
    expect(screen.getByRole('button', { name: /Réessayer dans 2/ })).toBeDisabled()
    await act(() => vi.advanceTimersByTimeAsync(2500))
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('names the hourly cap of the project when that is the limit', async () => {
    sendPasswordReset.mockRejectedValueOnce(hourly())
    await submit()
    expect(await screen.findByText(/nombre maximum d’e-mails par heure est atteint/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Envoyer le lien' })).toBeEnabled()
  })
})
