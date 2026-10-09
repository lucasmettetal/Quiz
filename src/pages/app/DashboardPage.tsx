import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Gamepad2, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { PersonAvatar } from '@/features/avatars/AvatarFace'
import { QuizCard, QuizCardSkeleton } from '@/features/quizzes/QuizCard'
import { useFavoriteIds } from '@/features/quizzes/queries'
import { useCreateQuiz } from '@/features/quizzes/useQuizActions'
import { SessionRow } from '@/features/results/SessionRow'
import { getDashboardStats, listMySessions } from '@/services/games'
import { listMyQuizzes } from '@/services/quizzes'
import { formatNumber, formatPercent } from '@/lib/format'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/translate'

function Scoreboard({ userId }: { userId: string }) {
  const { t, locale } = useI18n()
  const stats = useQuery({ queryKey: ['dashboard', 'stats', userId], queryFn: () => getDashboardStats(userId) })
  const items: Array<{ label: MessageKey; value: string | null }> = [
    { label: 'dashboard.statQuizzes', value: stats.data ? formatNumber(stats.data.quizzes, locale) : null },
    { label: 'dashboard.statGames', value: stats.data ? formatNumber(stats.data.games, locale) : null },
    { label: 'dashboard.statPlayers', value: stats.data ? formatNumber(stats.data.players, locale) : null },
    {
      label: 'dashboard.statAccuracy',
      value: stats.data ? (stats.data.accuracy === null ? '—' : formatPercent(stats.data.accuracy, locale)) : null,
    },
  ]
  if (stats.isError) return null
  // A scoreboard strip rather than four identical cards: numbers are the stars.
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-edge bg-stage text-stage-fg shadow-block md:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex flex-col gap-1 px-5 py-4 ${i % 2 ? 'border-l-2 border-white/10' : ''} ${i >= 2 ? 'border-t-2 border-white/10 md:border-t-0' : ''} ${i === 2 ? 'md:border-l-2' : ''}`}
        >
          <dt className="text-xs font-semibold tracking-wide text-paper/60 uppercase">{t(item.label)}</dt>
          <dd className="font-display text-3xl font-extrabold tabular sm:text-4xl">
            {item.value ?? <Skeleton className="mt-1 h-9 w-16 bg-white/10" />}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function DashboardPage() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const userId = profile!.id
  const create = useCreateQuiz()
  const favorites = useFavoriteIds()

  const quizzes = useQuery({
    queryKey: ['quizzes', 'mine', { recent: true }],
    queryFn: () => listMyQuizzes(userId, { sort: 'updated', limit: 4 }),
  })
  const sessions = useQuery({
    queryKey: ['sessions', 'mine', { limit: 5 }],
    queryFn: () => listMySessions(userId, { limit: 5 }),
  })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:px-8 lg:py-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-4">
          <Link to="/app/settings" aria-label={t('settings.title')} className="shrink-0 -rotate-3 rounded-lg border-2 border-edge bg-surface p-1.5 shadow-block-sm transition-transform duration-150 hover:rotate-0">
            <PersonAvatar config={profile!.avatar_config} name={profile!.id} size={64} />
          </Link>
          <div>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{t('dashboard.greeting', { name: profile!.display_name })}</h1>
            <p className="mt-1 text-fg-muted">{t('dashboard.lead')}</p>
          </div>
        </div>
        <ButtonLink to="/join" target="_blank" variant="secondary" icon={<Gamepad2 className="size-4" />}>
          {t('dashboard.quickJoin')}
        </ButtonLink>
      </header>

      <Scoreboard userId={userId} />

      <section aria-labelledby="recent-quizzes">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-quizzes" className="text-2xl font-bold">
            {t('dashboard.recentQuizzes')}
          </h2>
          {quizzes.data && quizzes.data.length > 0 && (
            <Link to="/app/quizzes" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
              {t('common.seeAll')} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
        {quizzes.isPending ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <QuizCardSkeleton key={i} />
            ))}
          </ul>
        ) : quizzes.isError ? (
          <ErrorState error={quizzes.error} onRetry={() => quizzes.refetch()} />
        ) : quizzes.data.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-line">
            <EmptyState
              icon={<Sparkles />}
              title={t('dashboard.emptyTitle')}
              description={t('dashboard.emptyText')}
              action={
                <Button size="lg" icon={<Plus className="size-5" />} loading={create.isPending} onClick={() => create.mutate()}>
                  {t('nav.createQuiz')}
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {quizzes.data.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} isOwner isFavorite={favorites.has(quiz.id)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-games">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-games" className="text-2xl font-bold">
            {t('dashboard.recentGames')}
          </h2>
          {sessions.data && sessions.data.length > 0 && (
            <Link to="/app/results" className="inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-fg">
              {t('common.seeAll')} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
        {sessions.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : sessions.isError ? (
          <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
        ) : sessions.data.length === 0 ? (
          <p className="rounded-md border-2 border-dashed border-line px-4 py-6 text-center text-sm text-fg-muted">{t('dashboard.emptyGames')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.data.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
