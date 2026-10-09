import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/ui/Logo'
import { PatternBlock } from '@/components/ui/misc'
import { useT } from '@/i18n/I18nProvider'
import { ANSWER_SLOTS } from '@/lib/palette'

const TILTS = [-8, 5, -3, 9]
const OFFSETS = [0, 18, 4, 22]

export function AuthLayout({ title, lead, children, footer }: { title: string; lead?: string; children: ReactNode; footer?: ReactNode }) {
  const t = useT()
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-stage p-12 text-stage-fg lg:flex lg:flex-col">
        <Link to="/" aria-label="Tilt">
          <Logo className="text-4xl" />
        </Link>
        <div className="relative my-auto">
          <div aria-hidden="true" className="relative mb-12 h-40">
            {ANSWER_SLOTS.slice(0, 4).map((slot, i) => (
              <div
                key={slot.letter}
                className="absolute top-0"
                style={{ left: `${i * 23}%`, transform: `rotate(${TILTS[i]}deg) translateY(${OFFSETS[i]}px)` }}
              >
                <PatternBlock
                  color={slot.color}
                  pattern={slot.pattern}
                  className="grid size-28 place-items-center rounded-md border-[3px] border-black font-display text-4xl font-black shadow-[5px_5px_0_0_#000]"
                >
                  {slot.letter}
                </PatternBlock>
              </div>
            ))}
          </div>
          <h2 className="max-w-md text-5xl leading-[1.02] font-extrabold">{t('auth.sideTitle')}</h2>
          <p className="mt-4 max-w-sm text-lg text-paper/70">{t('auth.sideText')}</p>
        </div>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <Link to="/" aria-label="Tilt" className="self-start lg:hidden">
          <Logo className="text-3xl" />
        </Link>
        <div className="mx-auto my-auto w-full max-w-sm animate-fade-up py-10">
          <h1 className="text-4xl font-extrabold">{title}</h1>
          {lead && <p className="mt-2 text-fg-muted">{lead}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-fg-muted">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
