import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Plus, SearchX, Sparkles } from 'lucide-react'
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
import { quizKeys, useCreateQuiz } from '@/features/quizzes/useQuizActions'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistentState } from '@/hooks/usePersistentState'
import { listMyQuizzes, type QuizSort, type QuizStatusFilter } from '@/services/quizzes'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

const SORTS: QuizSort[] = ['updated', 'created', 'title', 'plays']
const SORT_LABELS = { updated: 'quizzes.sortUpdated', created: 'quizzes.sortCreated', title: 'quizzes.sortTitle', plays: 'quizzes.sortPlays' } as const

export function QuizzesPage() {
  const t = useT()
  const { profile } = useAuth()
  const create = useCreateQuiz()
  const favorites = useFavoriteIds()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<QuizStatusFilter>('all')
  const [sort, setSort] = usePersistentState<QuizSort>('tilt.quizzes.sort', 'updated', SORTS)
  const [view, setView] = usePersistentState<'grid' | 'list'>('tilt.quizzes.view', 'grid', ['grid', 'list'])
  const debounced = useDebouncedValue(search.trim())
  const params = { search: debounced, status, sort }

  const query = useQuery({
    queryKey: quizKeys.mine(params),
    queryFn: () => listMyQuizzes(profile!.id, params),
    placeholderData: keepPreviousData,
  })
  const filtered = Boolean(debounced) || status !== 'all'

  const listClass = view === 'grid' ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'flex flex-col gap-2'

  return (
    <PageContainer>
      <PageHeader
        title={t('quizzes.title')}
        lead={t('quizzes.lead')}
        actions={
          <Button icon={<Plus className="size-5" />} loading={create.isPending} onClick={() => create.mutate()}>
            {t('nav.createQuiz')}
          </Button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder={t('quizzes.searchPlaceholder')} className="md:max-w-xs md:flex-1" />
        <SegmentedControl
          label={t('quizzes.title')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: t('quizzes.filterAll') },
            { value: 'draft', label: t('quizzes.filterDraft') },
            { value: 'published', label: t('quizzes.filterPublished') },
          ]}
        />
        <div className="flex items-center gap-2 md:ml-auto">
          <Select aria-label={t('quizzes.sortLabel')} value={sort} onChange={(e) => setSort(e.target.value as QuizSort)} className="h-10 w-auto">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(SORT_LABELS[s])}
              </option>
            ))}
          </Select>
          <SegmentedControl
            label={t('quizzes.viewGrid')}
            hideLabels
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: t('quizzes.viewGrid'), icon: <LayoutGrid className="size-4" /> },
              { value: 'list', label: t('quizzes.viewList'), icon: <List className="size-4" /> },
            ]}
          />
        </div>
      </div>

      {query.isPending ? (
        <ul className={listClass}>
          {Array.from({ length: 6 }, (_, i) => (
            <QuizCardSkeleton key={i} layout={view} />
          ))}
        </ul>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX />}
            color="cobalt"
            pattern="grid"
            title={debounced ? t('quizzes.noMatch', { query: debounced }) : t('quizzes.emptyTitle')}
            action={
              <Button variant="secondary" onClick={() => {
                  setSearch('')
                  setStatus('all')
                }}>
                {t('quizzes.clearFilters')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<Sparkles />}
            title={t('quizzes.emptyTitle')}
            description={t('quizzes.emptyText')}
            action={
              <Button size="lg" icon={<Plus className="size-5" />} loading={create.isPending} onClick={() => create.mutate()}>
                {t('nav.createQuiz')}
              </Button>
            }
          />
        )
      ) : (
        <ul className={cn(listClass, query.isPlaceholderData && 'opacity-60 transition-opacity')}>
          {query.data.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} isOwner isFavorite={favorites.has(quiz.id)} layout={view} />
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
