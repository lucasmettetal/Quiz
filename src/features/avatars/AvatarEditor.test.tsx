import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { I18nProvider } from '@/i18n/I18nProvider'
import { availableParts } from './catalog'
import { generateAvatarFromSeed, type AvatarConfig } from './avatar'
import { AvatarEditor } from './AvatarEditor'

function Harness({ onChange, initial }: { onChange?: (c: AvatarConfig) => void; initial: AvatarConfig }) {
  const [value, setValue] = useState(initial)
  return (
    <I18nProvider locale="fr">
      <AvatarEditor
        value={value}
        resetTo={initial}
        onChange={(c) => {
          setValue(c)
          onChange?.(c)
        }}
      />
    </I18nProvider>
  )
}

const start = { ...generateAvatarFromSeed('Zoé'), head: availableParts('head')[0]!.id, primary: 'teal' as const, secondary: 'amber' as const }

describe('AvatarEditor', () => {
  it('navigates categories with the keyboard (tabs pattern)', async () => {
    render(<Harness initial={start} />)
    const head = screen.getByRole('tab', { name: 'Tête' })
    expect(head).toHaveAttribute('aria-selected', 'true')
    head.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Yeux' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Yeux' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Motif' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Tête' })).toHaveFocus()
  })

  it('changes parts with labelled previous / next buttons', async () => {
    const onChange = vi.fn()
    render(<Harness initial={start} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suivant — Tête' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ head: availableParts('head')[1]!.id }))
    expect(screen.getByText(`Tête 2 sur ${availableParts('head').length}`)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Précédent — Tête' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ head: start.head }))
  })

  it('picks colors per slot, marking the selection with more than color', async () => {
    const onChange = vi.fn()
    render(<Harness initial={start} onChange={onChange} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Couleurs' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Cobalt' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ primary: 'cobalt', secondary: 'amber' }))
    expect(screen.getByRole('radio', { name: 'Cobalt' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Cobalt' }).querySelector('svg')).not.toBeNull() // check mark
    await userEvent.click(screen.getByRole('radio', { name: 'Secondaire' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Orchidée' }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ primary: 'cobalt', secondary: 'orchid' }))
  })

  it('resets to the proposed avatar', async () => {
    const onChange = vi.fn()
    render(<Harness initial={start} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Suivant — Tête' }))
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }))
    expect(onChange).toHaveBeenLastCalledWith(start)
  })
})
