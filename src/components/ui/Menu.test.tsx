import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Menu } from './Menu'

function renderMenu(onDelete = vi.fn()) {
  render(
    // Regression: quiz cards clip their content (overflow: hidden).
    <div data-testid="card" style={{ overflow: 'hidden', height: 40 }}>
      <Menu
        items={[
          { label: 'Dupliquer', onSelect: vi.fn() },
          { label: 'Partager', onSelect: vi.fn() },
          { label: 'Supprimer', tone: 'danger', onSelect: onDelete },
        ]}
        trigger={(props) => (
          <button type="button" {...props}>
            Plus d’actions
          </button>
        )}
      />
      <button type="button">ailleurs</button>
    </div>,
  )
  return onDelete
}

describe('Menu', () => {
  it('renders outside clipping containers and every item stays reachable', async () => {
    const onDelete = renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }))
    const menu = screen.getByRole('menu')
    expect(screen.getByTestId('card')).not.toContainElement(menu)
    expect(menu.parentElement).toBe(document.body)
    expect(menu.style.position).toBe('fixed')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('supports keyboard and closes on Escape or outside click', async () => {
    renderMenu()
    const trigger = screen.getByRole('button', { name: 'Plus d’actions' })
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Dupliquer' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: 'ailleurs' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
