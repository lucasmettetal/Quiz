import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from '@/components/ui/Toaster'
import { createGameSession } from '@/services/games'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

/** Creates a live session for a quiz and opens the presenter screen. */
export function useLaunchQuiz() {
  const navigate = useNavigate()
  const t = useT()
  return useMutation({
    mutationFn: (quizId: string) => createGameSession(quizId),
    onSuccess: (session) => navigate(`/host/${session.id}`),
    onError: (e, quizId) => {
      const { code } = toAppError(e)
      const fixable = code === 'QUIZ_INVALID' || code === 'QUIZ_EMPTY'
      toast({
        tone: 'error',
        message: t(`errors.${code}`),
        action: fixable ? { label: t('common.edit'), onClick: () => navigate(`/editor/${quizId}`) } : undefined,
      })
    },
  })
}
