import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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

/** Accessible dropdown menu (WAI-ARIA menu button pattern). */
export function Menu({ trigger, items, align = 'end', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (!open) return
    itemRefs.current.find((el) => el && !el.disabled)?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
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
      {open && (
        <div
          id={id}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn(
            'absolute top-full z-40 mt-1.5 min-w-48 animate-fade-up rounded-md border-2 border-edge bg-surface p-1 shadow-block',
            align === 'end' ? 'right-0' : 'left-0',
          )}
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
                'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm font-medium outline-none',
                'hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-40',
                item.tone === 'danger' ? 'text-danger' : 'text-fg',
              )}
            >
              {item.icon && <span className="text-fg-subtle [&>svg]:size-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
