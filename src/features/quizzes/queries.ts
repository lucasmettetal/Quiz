import { useQuery } from '@tanstack/react-query'
import { listFavoriteIds } from '@/services/quizzes'
import { quizKeys } from './useQuizActions'

const EMPTY = new Set<string>()

export function useFavoriteIds() {
  const query = useQuery({ queryKey: quizKeys.favoriteIds, queryFn: listFavoriteIds, staleTime: 60_000 })
  return query.data ?? EMPTY
}
