import { useInfiniteQuery } from '@tanstack/react-query'
import { Compass } from 'lucide-react'
import { useState } from 'react'
import { PageContainer, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { SegmentedControl } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { QuizCard, QuizCardSkeleton } from '@/features/quizzes/QuizCard'
import { useFavoriteIds } from '@/features/quizzes/queries'
import { quizKeys } from '@/features/quizzes/useQuizActions'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { listPublicQuizzes, type ExploreFilters } from '@/services/quizzes'
import { QUIZ_CATEGORIES, QUIZ_LANGUAGES, type QuizCategory } from '@/types/database'
import { useT } from '@/i18n/I18nProvider'

export function ExplorePage() {
  const t = useT()
  const { profile } = useAuth()
  const favorites = useFavoriteIds()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<QuizCategory | 'all'>('all')
  const [language, setLanguage] = useState<string>('all')
  const [sort, setSort] = useState<'recent' | 'popular'>('recent')
  const debounced = useDebouncedValue(search.trim())
  const filters: ExploreFilters = { search: debounced, category, language, sort }

  const query = useInfiniteQuery({
    queryKey: quizKeys.explore(filters),
    queryFn: ({ pageParam }) => listPublicQuizzes({ ...filters, page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
  })
  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <PageContainer>
      <PageHeader title={t('explore.title')} lead={t('explore.lead')} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder={t('explore.searchPlaceholder')} className="lg:max-w-xs lg:flex-1" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select aria-label={t('editor.meta.category')} value={category} onChange={(e) => setCategory(e.target.value as QuizCategory | 'all')} className="h-10 sm:w-48">
            <option value="all">{t('explore.allCategories')}</option>
            {QUIZ_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </Select>
          <Select aria-label={t('editor.meta.language')} value={language} onChange={(e) => setLanguage(e.target.value)} className="h-10 sm:w-44">
            <option value="all">{t('explore.allLanguages')}</option>
            {QUIZ_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`languages.${l}`)}
              </option>
            ))}
          </Select>
        </div>
        <SegmentedControl
          label={t('quizzes.sortLabel')}
          className="lg:ml-auto"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'recent', label: t('explore.sortRecent') },
            { value: 'popular', label: t('explore.sortPopular') },
          ]}
        />
      </div>

      {query.isPending ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </ul>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Compass />} color="teal" pattern="waves" title={t('explore.emptyTitle')} description={t('explore.emptyText')} />
      ) : (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} isOwner={quiz.owner_id === profile?.id} isFavorite={favorites.has(quiz.id)} />
            ))}
          </ul>
          {query.hasNextPage && (
            <Button variant="secondary" className="self-center" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
              {t('explore.loadMore')}
            </Button>
          )}
        </>
      )}
    </PageContainer>
  )
}
