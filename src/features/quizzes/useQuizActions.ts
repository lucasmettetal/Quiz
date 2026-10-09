import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { createQuiz, deleteQuiz, duplicateQuiz, setFavorite } from '@/services/quizzes'
import { toast } from '@/components/ui/Toaster'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

export const quizKeys = {
  all: ['quizzes'] as const,
  mine: (params: object) => ['quizzes', 'mine', params] as const,
  explore: (params: object) => ['quizzes', 'explore', params] as const,
  detail: (id: string) => ['quizzes', 'detail', id] as const,
  questions: (id: string) => ['quizzes', 'questions', id] as const,
  favorites: ['favorites'] as const,
  favoriteIds: ['favorites', 'ids'] as const,
}

export function useCreateQuiz() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => createQuiz(),
    onSuccess: (quiz) => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.all })
      navigate(`/editor/${quiz.id}`)
    },
  })
}

export function useDuplicateQuiz() {
  const queryClient = useQueryClient()
  const t = useT()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      duplicateQuiz(id, `${title || t('quizzes.untitled')} ${t('quizzes.copySuffix')}`.slice(0, 120)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.all })
      toast({ message: t('quizzes.duplicated') })
    },
    onError: (e) => toast({ message: t(`errors.${toAppError(e).code}`), tone: 'error' }),
  })
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient()
  const t = useT()
  return useMutation({
    mutationFn: (id: string) => deleteQuiz(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quizKeys.all })
      void queryClient.invalidateQueries({ queryKey: quizKeys.favorites })
      toast({ message: t('quizzes.deleted') })
    },
  })
}

export function useToggleFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => setFavorite(id, favorite),
    // Optimistic: the star reacts instantly, rolls back on failure.
    onMutate: async ({ id, favorite }) => {
      await queryClient.cancelQueries({ queryKey: quizKeys.favoriteIds })
      const previous = queryClient.getQueryData<Set<string>>(quizKeys.favoriteIds)
      const next = new Set(previous)
      if (favorite) next.add(id)
      else next.delete(id)
      queryClient.setQueryData(quizKeys.favoriteIds, next)
      return { previous }
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(quizKeys.favoriteIds, ctx?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: quizKeys.favorites }),
  })
}
