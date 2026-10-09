import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { PageContainer, PageHeader } from '@/components/layout/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/AuthProvider'
import { QuizCard, QuizCardSkeleton } from '@/features/quizzes/QuizCard'
import { useFavoriteIdsQuery } from '@/features/quizzes/queries'
import { quizKeys } from '@/features/quizzes/useQuizActions'
import { listFavoriteQuizzes } from '@/services/quizzes'
import { useT } from '@/i18n/I18nProvider'

export function FavoritesPage() {
  const t = useT()
  const { profile } = useAuth()
  const favoriteIds = useFavoriteIdsQuery().data
  const query = useQuery({ queryKey: quizKeys.favorites, queryFn: listFavoriteQuizzes })
  // Hide un-starred quizzes immediately (optimistic ids) without waiting for a refetch.
  const items = query.data?.filter((q) => !favoriteIds || favoriteIds.has(q.id)) ?? []

  return (
    <PageContainer>
      <PageHeader title={t('favorites.title')} lead={t('favorites.lead')} />
      {query.isPending ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </ul>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Star />}
          color="amber"
          pattern="checker"
          title={t('favorites.emptyTitle')}
          description={t('favorites.emptyText')}
          action={
            <ButtonLink to="/app/explore" variant="secondary">
              {t('nav.explore')}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} isOwner={quiz.owner_id === profile?.id} isFavorite />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
