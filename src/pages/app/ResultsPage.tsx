import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { SessionRow } from '@/features/results/SessionRow'
import { listMySessions } from '@/services/games'
import { useT } from '@/i18n/I18nProvider'

export function ResultsPage() {
  const t = useT()
  const { profile } = useAuth()
  const sessions = useQuery({ queryKey: ['sessions', 'mine', { all: true }], queryFn: () => listMySessions(profile!.id) })

  return (
    <PageContainer>
      <PageHeader title={t('results.title')} lead={t('results.lead')} />
      {sessions.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : sessions.data.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          color="cobalt"
          pattern="grid"
          title={t('results.emptyTitle')}
          description={t('results.emptyText')}
          action={
            <ButtonLink to="/app/quizzes" variant="secondary">
              {t('nav.quizzes')}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.data.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
