import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '@/i18n/I18nProvider'
import { PinForm } from '@/features/game/player/PinForm'
import type { PublicQuestion } from '../public'
import { PlayerAnswerInput } from './PlayerInputs'

const wrap = (ui: React.ReactNode) => render(<I18nProvider locale="fr">{ui}</I18nProvider>)

const quiz = (multi = false): PublicQuestion => ({
  id: 'q', type: 'quiz', prompt: 'Capitale ?', media: null, time_limit_s: 20, points: 1000,
  content: { multi, options: [{ id: 'a', text: 'Paris' }, { id: 'b', text: 'Lyon' }, { id: 'c', text: 'Nice' }] },
})

describe('PlayerAnswerInput', () => {
  it('submits a single choice on tap', async () => {
    const onSubmit = vi.fn()
    wrap(<PlayerAnswerInput question={quiz()} submitted={null} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: /Lyon/ }))
    expect(onSubmit).toHaveBeenCalledWith({ optionIds: ['b'] })
  })

  it('requires confirmation for multiple answers', async () => {
    const onSubmit = vi.fn()
    wrap(<PlayerAnswerInput question={quiz(true)} submitted={null} onSubmit={onSubmit} />)
    expect(screen.getByText('Plusieurs réponses possibles')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Paris/ }))
    await userEvent.click(screen.getByRole('button', { name: /Nice/ }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /Paris/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }))
    expect(onSubmit).toHaveBeenCalledWith({ optionIds: ['a', 'c'] })
  })

  it('locks after submitting and reveals the solution', () => {
    wrap(<PlayerAnswerInput question={quiz()} submitted={{ optionIds: ['b'] }} onSubmit={vi.fn()} solution={{ optionIds: ['a'] }} />)
    for (const name of [/Paris/, /Lyon/, /Nice/]) expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('sends typed answers trimmed', async () => {
    const onSubmit = vi.fn()
    wrap(<PlayerAnswerInput question={{ ...quiz(), type: 'text', content: {} }} submitted={null} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('Ta réponse'), '  Oslo {Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ text: 'Oslo' })
  })

  it('offers true / false with letters that are not color-only', async () => {
    const onSubmit = vi.fn()
    wrap(<PlayerAnswerInput question={{ ...quiz(), type: 'true_false', content: {} }} submitted={null} onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: /Faux/ }))
    expect(onSubmit).toHaveBeenCalledWith({ value: false })
  })
})

describe('PinForm', () => {
  it('keeps digits only, formats, and submits 6 digits', async () => {
    const onSubmit = vi.fn()
    wrap(<PinForm onSubmit={onSubmit} />)
    const input = screen.getByLabelText('PIN de la partie')
    const button = screen.getByRole('button', { name: /Valider/ })
    await userEvent.type(input, '12a3 45')
    expect(input).toHaveValue('12345')
    expect(button).toBeDisabled()
    await userEvent.type(input, '6789')
    expect(input).toHaveValue('123 456')
    await userEvent.click(button)
    expect(onSubmit).toHaveBeenCalledWith('123456')
  })
})
