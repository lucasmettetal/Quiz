import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

interface MenuProps {
  trigger: (props: { 'aria-haspopup': 'menu'; 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  className?: string
}

const GAP = 6
const VIEWPORT_MARGIN = 8

/**
 * Accessible dropdown menu (WAI-ARIA menu button pattern).
 *
 * The list is rendered in a portal with fixed positioning, so it is never
 * clipped by a parent with `overflow: hidden` or a scroll container (quiz
 * cards, panels). It opens below the trigger, flips above when there is not
 * enough room, and stays inside the viewport horizontally.
 */
export function Menu({ trigger, items, align = 'end', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Position the floating list next to its trigger (and keep it there on scroll/resize).
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = rootRef.current?.querySelector<HTMLElement>('[aria-haspopup]') ?? rootRef.current
      const menu = menuRef.current
      if (!anchor || !menu) return
      const r = anchor.getBoundingClientRect()
      const { offsetHeight: h, offsetWidth: w } = menu
      const spaceBelow = window.innerHeight - r.bottom
      const openUp = spaceBelow < h + GAP + VIEWPORT_MARGIN && r.top > spaceBelow
      const top = openUp ? r.top - GAP - h : r.bottom + GAP
      const preferredLeft = align === 'end' ? r.right - w : r.left
      const left = Math.min(Math.max(VIEWPORT_MARGIN, preferredLeft), window.innerWidth - w - VIEWPORT_MARGIN)
      menu.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`
      menu.style.left = `${left}px`
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    itemRefs.current.find((el) => el && !el.disabled)?.focus({ preventScroll: true })
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  function close(focusTrigger = true) {
    setOpen(false)
    if (focusTrigger) rootRef.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const enabled = itemRefs.current.filter((el): el is HTMLButtonElement => !!el && !el.disabled)
    const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      enabled[(index + 1) % enabled.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      enabled[(index - 1 + enabled.length) % enabled.length]?.focus()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen((o) => !o) })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={id}
            role="menu"
            onKeyDown={onKeyDown}
            // Fixed + placed by the layout effect before paint (no flash at 0,0).
            style={{ position: 'fixed', top: 0, left: 0 }}
            className="z-50 max-h-[calc(100dvh-16px)] min-w-48 animate-fade-up overflow-y-auto rounded-md border-2 border-edge bg-surface p-1 shadow-block"
          >
            {items.map((item, i) => (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  close()
                  item.onSelect()
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm font-medium outline-none',
                  'hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-40',
                  item.tone === 'danger' ? 'text-danger-ink' : 'text-fg',
                )}
              >
                {item.icon && <span className="text-fg-subtle [&>svg]:size-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
