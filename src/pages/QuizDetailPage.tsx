import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Copy, Eye, EyeOff, Pencil, Play, Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ErrorState } from '@/components/ui/States'
import { Avatar, Skeleton } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { questionFromRow } from '@/features/questions/registry'
import { QuestionSummary } from '@/features/questions/ui/QuestionSummary'
import { QuizCover } from '@/features/quizzes/QuizCover'
import { useFavoriteIds } from '@/features/quizzes/queries'
import { quizKeys, useDuplicateQuiz, useToggleFavorite } from '@/features/quizzes/useQuizActions'
import { useLaunchQuiz } from '@/features/quizzes/useLaunchQuiz'
import { getQuiz, getQuizQuestions } from '@/services/quizzes'
import { useT } from '@/i18n/I18nProvider'

export function QuizDetailPage() {
  const { quizId = '' } = useParams()
  const t = useT()
  const navigate = useNavigate()
  const { userId, isAnonymous } = useAuth()
  const isCreator = Boolean(userId) && !isAnonymous
  const [showAnswers, setShowAnswers] = useState(false)
  const favorites = useFavoriteIds()
  const launch = useLaunchQuiz()
  const duplicate = useDuplicateQuiz()
  const favorite = useToggleFavorite()

  const quiz = useQuery({ queryKey: quizKeys.detail(quizId), queryFn: () => getQuiz(quizId) })
  const questions = useQuery({
    queryKey: quizKeys.questions(quizId),
    queryFn: async () => (await getQuizQuestions(quizId)).map(questionFromRow).filter((q) => q !== null),
    enabled: quiz.isSuccess,
  })

  const isOwner = quiz.data?.owner_id === userId
  const isFavorite = favorites.has(quizId)

  return (
    <div className="min-h-dvh bg-bg">
      <header className="flex items-center justify-between border-b-2 border-line bg-surface px-4 py-3 sm:px-8">
        <Link to={isCreator ? '/app/explore' : '/'} className="inline-flex items-center gap-2 text-sm font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {t('common.back')}
        </Link>
        <Link to="/" aria-label="Tilt">
          <Logo />
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        {quiz.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="aspect-[3/1] rounded-lg" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : quiz.isError ? (
          <ErrorState error={quiz.error} title={t('quizDetail.notFoundTitle')} />
        ) : (
          <>
            <QuizCover
              color={quiz.data.cover_color}
              pattern={quiz.data.cover_pattern}
              imagePath={quiz.data.cover_image_path}
              title={quiz.data.title}
              className="aspect-[3/1] rounded-lg border-2 border-edge shadow-block [&>span]:text-[10rem]"
            />
            <div className="mt-6 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg-subtle">
                  {t(`categories.${quiz.data.category}`)} · {t('common.questions', { count: quiz.data.question_count })} ·{' '}
                  {t('quizDetail.playedTimes', { count: quiz.data.play_count })}
                </p>
                <h1 className="mt-1 text-4xl font-extrabold">{quiz.data.title || t('quizzes.untitled')}</h1>
                {quiz.data.author && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
                    <Avatar name={quiz.data.author.display_name} color={quiz.data.author.avatar_color} size="sm" />
                    {t('common.by', { name: quiz.data.author.display_name })}
                  </p>
                )}
                {quiz.data.description && <p className="mt-4 max-w-prose leading-relaxed">{quiz.data.description}</p>}
                {quiz.data.quiz_tags && quiz.data.quiz_tags.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-2 text-sm font-semibold text-fg-subtle">
                    {quiz.data.quiz_tags.map(({ tag }) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </p>
                )}
              </div>

              {isCreator ? (
                <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
                  <Button size="lg" icon={<Play className="size-5" />} loading={launch.isPending} onClick={() => launch.mutate(quizId)}>
                    {t('common.launch')}
                  </Button>
                  {isOwner ? (
                    <ButtonLink to={`/editor/${quizId}`} variant="secondary" icon={<Pencil className="size-4" />}>
                      {t('common.edit')}
                    </ButtonLink>
                  ) : (
                    <Button
                      variant="secondary"
                      icon={<Copy className="size-4" />}
                      loading={duplicate.isPending}
                      onClick={() => duplicate.mutate({ id: quizId, title: quiz.data.title }, { onSuccess: () => navigate('/app/quizzes') })}
                    >
                      {t('explore.duplicateToLibrary')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    aria-pressed={isFavorite}
                    icon={<Star className={isFavorite ? 'size-4 fill-amber text-amber-deep' : 'size-4'} />}
                    onClick={() => favorite.mutate({ id: quizId, favorite: !isFavorite })}
                  >
                    {isFavorite ? t('quizzes.unfavorite') : t('quizzes.favorite')}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border-2 border-line bg-surface p-4 text-sm md:max-w-60">
                  <p>{t('quizDetail.signInToLaunch')}</p>
                  <ButtonLink to={`/auth/login?next=/quiz/${quizId}`} className="mt-3 w-full">
                    {t('nav.signIn')}
                  </ButtonLink>
                </div>
              )}
            </div>

            <section className="mt-10" aria-labelledby="questions-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="questions-title" className="text-2xl font-bold">
                  {t('quizDetail.questionsTitle')}
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={showAnswers}
                  icon={showAnswers ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  onClick={() => setShowAnswers((s) => !s)}
                >
                  {showAnswers ? t('quizDetail.hiddenAnswers') : t('quizDetail.showAnswers')}
                </Button>
              </div>
              {questions.isPending ? (
                <Skeleton className="h-40" />
              ) : questions.isError ? (
                <ErrorState error={questions.error} onRetry={() => questions.refetch()} />
              ) : (
                <ol className="flex flex-col gap-2">
                  {questions.data.map((q, i) => (
                    <QuestionSummary key={q.id} question={q} index={i} showAnswers={showAnswers} />
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
