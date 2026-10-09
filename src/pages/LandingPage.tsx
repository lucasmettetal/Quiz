import { CheckCheck, Keyboard, ListChecks, PieChart, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { PatternBlock, SegmentedControl } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { PinForm } from '@/features/game/player/PinForm'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/translate'
import { cn } from '@/lib/cn'
import { ANSWER_SLOTS, type PaletteColor, type PatternName } from '@/lib/palette'

function HeroIllustration() {
  const { t } = useI18n()
  // Four answer tiles in Tilt's slot system + a countdown: the product in one glance.
  return (
    <div role="img" aria-label={t('landing.illustrationLabel')} className="pointer-events-none relative h-full w-full select-none">
      {ANSWER_SLOTS.slice(0, 4).map((slot, i) => {
        const pos = [
          'top-0 left-[6%] -rotate-[8deg]',
          'top-[4%] right-[2%] rotate-[6deg]',
          'bottom-[6%] left-0 rotate-[4deg]',
          'bottom-0 right-[8%] -rotate-[5deg]',
        ][i]
        return (
          <PatternBlock
            key={slot.letter}
            color={slot.color}
            pattern={slot.pattern}
            className={cn('absolute size-24 rounded-md border-2 border-edge shadow-block sm:size-28', pos)}
          >
            <span className="absolute top-2 left-2 grid size-9 rotate-[-4deg] place-items-center rounded-sm border-2 border-edge bg-paper font-display text-lg font-black text-ink">
              {slot.letter}
            </span>
          </PatternBlock>
        )
      })}
    </div>
  )
}

const STEPS: Array<{ n: string; title: MessageKey; text: MessageKey; color: PaletteColor; rotate: string }> = [
  { n: '1', title: 'landing.step1Title', text: 'landing.step1Text', color: 'amber', rotate: '-rotate-6' },
  { n: '2', title: 'landing.step2Title', text: 'landing.step2Text', color: 'cobalt', rotate: 'rotate-3' },
  { n: '3', title: 'landing.step3Title', text: 'landing.step3Text', color: 'lime', rotate: '-rotate-3' },
]

const STEP_BG: Record<string, string> = { amber: 'bg-amber text-ink', cobalt: 'bg-cobalt text-white', lime: 'bg-lime text-ink' }

const TYPES: Array<{
  key: 'quiz' | 'true_false' | 'text' | 'poll'
  icon: typeof ListChecks
  color: PaletteColor
  pattern: PatternName
}> = [
  { key: 'quiz', icon: ListChecks, color: 'vermilion', pattern: 'stripes' },
  { key: 'true_false', icon: CheckCheck, color: 'teal', pattern: 'waves' },
  { key: 'text', icon: Keyboard, color: 'cobalt', pattern: 'dots' },
  { key: 'poll', icon: PieChart, color: 'amber', pattern: 'zigzag' },
]

export function LandingPage() {
  const { t, locale, setLocale } = useI18n()
  const navigate = useNavigate()
  const { userId, isAnonymous } = useAuth()
  const isCreator = Boolean(userId) && !isAnonymous

  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" aria-label="Tilt">
          <Logo className="text-3xl" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {isCreator ? (
            <ButtonLink to="/app" variant="primary">
              {t('nav.home')}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/auth/login" variant="ghost" className="hidden sm:inline-flex">
                {t('nav.signIn')}
              </ButtonLink>
              <ButtonLink to="/auth/signup" variant="primary">
                {t('landing.ctaCreate')}
              </ButtonLink>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-16 lg:pt-12 lg:pb-24">
        <div className="animate-fade-up">
          <h1 className="font-display text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92] font-extrabold tracking-[-0.04em]">
            {t('landing.heroTitle')}{' '}
            <span className="relative mt-2 inline-block -rotate-3 rounded-md border-[3px] border-edge bg-primary px-3 pb-1 text-white shadow-block-lg">
              {t('landing.heroTitleAccent')}
            </span>
          </h1>
          <p className="mt-8 hidden max-w-xl text-xl leading-relaxed text-fg-muted lg:block">{t('landing.heroLead')}</p>
          <div className="mt-8 hidden flex-wrap gap-3 lg:flex">
            <ButtonLink to={isCreator ? '/app' : '/auth/signup'} size="xl" icon={<Plus className="size-6" />}>
              {t('landing.ctaCreate')}
            </ButtonLink>
            <ButtonLink to="/app/explore" size="xl" variant="secondary">
              {t('landing.ctaExplore')}
            </ButtonLink>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute -inset-x-6 -inset-y-10 -z-0 hidden sm:block">
            <HeroIllustration />
          </div>
          <div className="relative z-10 mx-auto max-w-sm rotate-[1.5deg] rounded-lg border-[3px] border-edge bg-stage p-6 text-stage-fg shadow-block-lg transition-transform duration-300 hover:rotate-0 sm:p-7">
            <p className="font-display text-sm font-bold tracking-[0.2em] text-lime uppercase">{t('nav.joinGame')}</p>
            <h2 className="mt-1 text-3xl font-extrabold">{t('landing.joinTitle')}</h2>
            <p className="mt-1 mb-5 text-sm text-paper/70">{t('landing.joinHint')}</p>
            <PinForm tone="stage" submitLabel={t('landing.joinAction')} onSubmit={(pin) => navigate(`/join/${pin}`)} />
            <p className="mt-4 text-center text-xs text-paper/60">{t('landing.noAccount')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:hidden">
          <p className="w-full text-lg leading-relaxed text-fg-muted">{t('landing.heroLead')}</p>
          <ButtonLink to={isCreator ? '/app' : '/auth/signup'} size="lg" icon={<Plus className="size-5" />}>
            {t('landing.ctaCreate')}
          </ButtonLink>
          <ButtonLink to="/app/explore" size="lg" variant="secondary">
            {t('landing.ctaExplore')}
          </ButtonLink>
        </div>
      </section>

      {/* Steps — on the dark "stage", like the game itself */}
      <section className="bg-stage text-stage-fg">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
          <h2 className="max-w-2xl text-4xl font-extrabold sm:text-5xl">{t('landing.stepsTitle')}</h2>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <div aria-hidden="true" className="absolute top-8 right-[16%] left-[16%] hidden border-t-[3px] border-dashed border-paper/25 md:block" />
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <span
                  className={cn(
                    'relative grid size-16 place-items-center rounded-md border-[3px] border-black font-display text-3xl font-black shadow-[4px_4px_0_0_#000]',
                    s.rotate,
                    STEP_BG[s.color],
                  )}
                >
                  {s.n}
                </span>
                <h3 className="mt-6 text-2xl font-bold">{t(s.title)}</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-paper/70">{t(s.text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Question types */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <h2 className="max-w-xl text-4xl font-extrabold sm:text-5xl">{t('landing.typesTitle')}</h2>
          <p className="max-w-sm text-fg-muted">{t('landing.typesLead')}</p>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map(({ key, icon: Icon, color, pattern }, i) => (
            <li
              key={key}
              className={cn(
                'group overflow-hidden rounded-lg border-2 border-edge bg-surface shadow-block transition-transform duration-200 hover:-translate-y-1',
                i % 2 ? 'lg:translate-y-6 lg:hover:translate-y-5' : '',
              )}
            >
              <PatternBlock color={color} pattern={pattern} className="grid h-32 place-items-center border-b-2 border-edge">
                <span className="grid size-16 -rotate-6 place-items-center rounded-md border-2 border-edge bg-paper text-ink shadow-block-sm transition-transform duration-200 group-hover:rotate-3">
                  <Icon className="size-8" />
                </span>
              </PatternBlock>
              <div className="p-5">
                <p className="text-xs font-bold tracking-widest text-fg-subtle uppercase">
                  {t(key === 'poll' ? 'questionTypes.categoryCollect' : 'questionTypes.categoryTest')}
                </p>
                <h3 className="mt-1 text-xl font-bold">{t(`questionTypes.${key}.name`)}</h3>
                <p className="mt-1 text-sm text-fg-muted">{t(`questionTypes.${key}.description`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Audience */}
      <section className="border-y-2 border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-14 sm:px-8 md:grid-cols-2 md:items-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">{t('landing.audienceTitle')}</h2>
          <p className="text-lg leading-relaxed text-fg-muted">{t('landing.audienceText')}</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <PatternBlock
          color="vermilion"
          pattern="stripes"
          intensity="subtle"
          className="mx-auto max-w-5xl -rotate-1 rounded-lg border-[3px] border-edge px-6 py-12 text-center shadow-block-lg sm:px-12"
        >
          <h2 className="mx-auto max-w-2xl text-4xl font-extrabold sm:text-5xl">{t('landing.finalTitle')}</h2>
          <ButtonLink to={isCreator ? '/app' : '/auth/signup'} variant="ink" size="xl" className="mt-8">
            {t('landing.finalCta')}
          </ButtonLink>
        </PatternBlock>
      </section>

      <footer className="border-t-2 border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-sm text-fg-muted">{t('landing.footer')}</span>
          </div>
          <SegmentedControl
            label={t('locale.label')}
            size="sm"
            value={locale}
            onChange={setLocale}
            options={[
              { value: 'fr', label: 'FR' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </div>
      </footer>
    </div>
  )
}
