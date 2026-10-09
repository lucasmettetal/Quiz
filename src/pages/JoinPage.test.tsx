import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { I18nProvider } from '@/i18n/I18nProvider'
import { generateAvatarFromSeed } from '@/features/avatars/avatar'

const findSession = vi.fn()
const joinSession = vi.fn()
vi.mock('@/services/play', () => ({ findSession, joinSession }))
vi.mock('@/services/auth', () => ({ ensurePlayerIdentity: vi.fn().mockResolvedValue('u1') }))

const { JoinPage } = await import('./JoinPage')

function renderJoin() {
  return render(
    <I18nProvider locale="fr">
      <MemoryRouter initialEntries={['/join/482913']}>
        <Routes>
          <Route path="/join/:pin" element={<JoinPage />} />
          <Route path="/play/:id" element={<p>En jeu</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  findSession.mockResolvedValue({ session_id: 's1', quiz_title: 'Capitales', state: 'LOBBY', reason: null })
  joinSession.mockResolvedValue({ session_id: 's1' })
})

describe('JoinPage avatar', () => {
  it('keeps advanced controls hidden by default and joins in one click with the proposed avatar', async () => {
    renderJoin()
    const input = await screen.findByLabelText('Pseudo')
    // (jsdom keeps inert content in the accessibility tree; browsers don't.)
    const reachable = (name: RegExp) => screen.getAllByRole('button', { name }).filter((b) => !b.closest('[inert]'))
    expect(reachable(/Aléatoire/)).toHaveLength(1)
    expect(reachable(/Suivant/)).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Personnaliser/ })).toHaveAttribute('aria-expanded', 'false')
    // The panel is collapsed and inert: its controls can't be reached.
    expect(document.getElementById('avatar-panel')).toHaveAttribute('inert')
    await userEvent.type(input, 'Zoé')
    await userEvent.click(screen.getByRole('button', { name: /C’est parti/ }))
    expect(joinSession).toHaveBeenCalledWith('482913', 'Zoé', generateAvatarFromSeed('Zoé'))
    expect(await screen.findByText('En jeu')).toBeInTheDocument()
  })

  it('opens customization in place, focuses it, and closes back to the customize button', async () => {
    renderJoin()
    await userEvent.type(await screen.findByLabelText('Pseudo'), 'Zoé')
    await userEvent.click(screen.getByRole('button', { name: /Personnaliser/ }))
    const panel = document.getElementById('avatar-panel')!
    expect(panel).not.toHaveAttribute('inert')
    await vi.waitFor(() => expect(screen.getByRole('tab', { name: 'Tête' })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Suivant — Tête' }))
    await userEvent.click(screen.getByRole('button', { name: /Terminé/ }))
    expect(panel).toHaveAttribute('inert')
    await vi.waitFor(() => expect(screen.getByRole('button', { name: /Personnaliser/ })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: /C’est parti/ }))
    const sent = joinSession.mock.calls[0]![2]
    expect(sent.head).not.toBe(generateAvatarFromSeed('Zoé').head)
  })
})
