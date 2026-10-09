import { ButtonLink } from '@/components/ui/Button'
import { PatternBlock } from '@/components/ui/misc'
import { useT } from '@/i18n/I18nProvider'

export function NotFoundPage() {
  const t = useT()
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
      <div>
        <div aria-hidden="true" className="mx-auto mb-8 flex justify-center gap-2 font-display text-7xl font-black">
          <PatternBlock color="vermilion" pattern="stripes" className="grid size-24 -rotate-12 place-items-center rounded-md border-[3px] border-edge shadow-block">
            4
          </PatternBlock>
          <PatternBlock color="amber" pattern="zigzag" className="grid size-24 translate-y-4 rotate-6 place-items-center rounded-md border-[3px] border-edge shadow-block">
            0
          </PatternBlock>
          <PatternBlock color="cobalt" pattern="dots" className="grid size-24 rotate-[20deg] place-items-center rounded-md border-[3px] border-edge shadow-block">
            4
          </PatternBlock>
        </div>
        <h1 className="text-4xl font-extrabold">{t('errors.notFoundTitle')}</h1>
        <p className="mt-2 text-fg-muted">{t('errors.notFoundText')}</p>
        <ButtonLink to="/" className="mt-8" size="lg">
          {t('errors.goHome')}
        </ButtonLink>
      </div>
    </main>
  )
}
