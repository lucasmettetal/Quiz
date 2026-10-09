import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { I18nProvider } from '@/i18n/I18nProvider'
import { AppError } from '@/lib/errors'

const completeAuthRedirect = vi.fn()
const updatePassword = vi.fn()
vi.mock('@/services/auth', () => ({ completeAuthRedirect, updatePassword }))

const { ResetPasswordPage } = await import('./ResetPasswordPage')

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nProvider locale="fr">
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/auth/reset']}>
          <Routes>
            <Route path="/auth/reset" element={<ResetPasswordPage />} />
            <Route path="/app" element={<p>Tableau de bord</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('/auth/reset', () => {
  it('shows a clear error and a way out when the link is expired', async () => {
    completeAuthRedirect.mockRejectedValue(new AppError('LINK_EXPIRED'))
    renderPage()
    expect(await screen.findByText(/Ce lien a expiré/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '/auth/forgot')
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
  })

  it('refuses to show the form without a recovery session (no link, ordinary session)', async () => {
    completeAuthRedirect.mockResolvedValue({ fromLink: false, session: { user: { id: 'u1' } } })
    renderPage()
    expect(await screen.findByText(/n’est pas valide ou a déjà été utilisé/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument()
  })

  it('explains a link opened on another device', async () => {
    completeAuthRedirect.mockRejectedValue(new AppError('LINK_OTHER_DEVICE'))
    renderPage()
    expect(await screen.findByText(/navigateur où tu as fait la demande/)).toBeInTheDocument()
  })

  it('updates the password from a valid recovery link, then opens the app', async () => {
    completeAuthRedirect.mockResolvedValue({ fromLink: true, session: { user: { id: 'u1' } } })
    updatePassword.mockResolvedValue(undefined)
    renderPage()
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), 'nouveau-mdp-1')
    await userEvent.type(screen.getByLabelText('Confirme le mot de passe'), 'nouveau-mdp-1')
    await userEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }))
    expect(updatePassword).toHaveBeenCalledWith('nouveau-mdp-1')
    expect(await screen.findByText('Tableau de bord')).toBeInTheDocument()
    expect(sessionStorage.getItem('tilt.recovery')).toBeNull()
  })

  it('keeps the form and explains a rate limit', async () => {
    completeAuthRedirect.mockResolvedValue({ fromLink: true, session: { user: { id: 'u1' } } })
    updatePassword.mockRejectedValue(Object.assign(new Error('rate limit'), { status: 429 }))
    renderPage()
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), 'nouveau-mdp-1')
    await userEvent.type(screen.getByLabelText('Confirme le mot de passe'), 'nouveau-mdp-1')
    await userEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }))
    expect(await screen.findByText('Trop de demandes ont été effectuées. Réessaie dans quelques minutes.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument()
  })

  it('checks that both passwords match before calling Supabase', async () => {
    completeAuthRedirect.mockResolvedValue({ fromLink: true, session: { user: { id: 'u1' } } })
    renderPage()
    await userEvent.type(await screen.findByLabelText('Nouveau mot de passe'), 'nouveau-mdp-1')
    await userEvent.type(screen.getByLabelText('Confirme le mot de passe'), 'autre-chose')
    await userEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }))
    expect(screen.getByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument()
    expect(updatePassword).not.toHaveBeenCalled()
  })
})
