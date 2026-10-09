import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { listFavoriteIds } from '@/services/quizzes'
import { quizKeys } from './useQuizActions'

const EMPTY = new Set<string>()

/** Favorites only exist for registered creators. */
export function useFavoriteIdsQuery() {
  const { profile } = useAuth()
  return useQuery({ queryKey: quizKeys.favoriteIds, queryFn: listFavoriteIds, staleTime: 60_000, enabled: Boolean(profile) })
}

export function useFavoriteIds() {
  return useFavoriteIdsQuery().data ?? EMPTY
}
