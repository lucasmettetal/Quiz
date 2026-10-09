import { memo, useState } from 'react'
import { Copy, Eye, MoreHorizontal, Pencil, Play, Share2, Star, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { Badge } from '@/components/ui/misc'
import { PersonAvatar } from '@/features/avatars/AvatarFace'
import { cn } from '@/lib/cn'
import { formatRelative } from '@/lib/format'
import { useI18n } from '@/i18n/I18nProvider'
import type { QuizWithMeta } from '@/services/quizzes'
import { QuizCover } from './QuizCover'
import { ShareQuizDialog } from './ShareQuizDialog'
import { useDeleteQuiz, useDuplicateQuiz, useToggleFavorite } from './useQuizActions'
import { useLaunchQuiz } from './useLaunchQuiz'

interface QuizCardProps {
  quiz: QuizWithMeta
  isOwner: boolean
  isFavorite: boolean
  layout?: 'grid' | 'list'
}

function useQuizCardActions(quiz: QuizWithMeta, isOwner: boolean, isFavorite: boolean) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const launch = useLaunchQuiz()
  const duplicate = useDuplicateQuiz()
  const remove = useDeleteQuiz()
  const favorite = useToggleFavorite()
  const [shareOpen, setShareOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const items: MenuItem[] = [
    ...(isOwner ? [] : [{ label: t('explore.view'), icon: <Eye />, onSelect: () => navigate(`/quiz/${quiz.id}`) }]),
    {
      label: isOwner ? t('common.duplicate') : t('explore.duplicateToLibrary'),
      icon: <Copy />,
      onSelect: () => duplicate.mutate({ id: quiz.id, title: quiz.title }),
    },
    {
      label: isFavorite ? t('quizzes.unfavorite') : t('quizzes.favorite'),
      icon: <Star />,
      onSelect: () => favorite.mutate({ id: quiz.id, favorite: !isFavorite }),
    },
    ...(isOwner
      ? [
          { label: t('common.share'), icon: <Share2 />, onSelect: () => setShareOpen(true) },
          { label: t('common.delete'), icon: <Trash2 />, tone: 'danger' as const, onSelect: () => setDeleteOpen(true) },
        ]
      : []),
  ]

  const dialogs = (
    <>
      {isOwner && <ShareQuizDialog quiz={quiz} open={shareOpen} onClose={() => setShareOpen(false)} />}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('quizzes.deleteTitle', { title: quiz.title || t('quizzes.untitled') })}
        description={t('quizzes.deleteText')}
        confirmLabel={t('common.delete')}
        onConfirm={() => remove.mutateAsync(quiz.id)}
      />
    </>
  )

  return { items, dialogs, launch, favorite }
}

function MetaLine({ quiz, isOwner }: { quiz: QuizWithMeta; isOwner: boolean }) {
  const { t, locale } = useI18n()
  const when = formatRelative(quiz.updated_at, locale) ?? t('time.justNow')
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
      {!isOwner && quiz.author && (
        <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
          <PersonAvatar config={quiz.author.avatar_config} name={quiz.owner_id} size={20} />
          {quiz.author.display_name}
        </span>
      )}
      <span>{t('common.questions', { count: quiz.question_count })}</span>
      <span aria-hidden="true">·</span>
      <span>{t('common.plays', { count: quiz.play_count })}</span>
      {isOwner && (
        <>
          <span aria-hidden="true">·</span>
          <span>{t('quizzes.updated', { when })}</span>
        </>
      )}
    </p>
  )
}

function StatusBadges({ quiz }: { quiz: QuizWithMeta }) {
  const { t } = useI18n()
  return quiz.status === 'draft' ? (
    <Badge tone="ink">{t('quizzes.draft')}</Badge>
  ) : (
    <Badge tone="success">{t(`quizzes.visibility.${quiz.visibility}`)}</Badge>
  )
}

export const QuizCard = memo(function QuizCard({ quiz, isOwner, isFavorite, layout = 'grid' }: QuizCardProps) {
  const { t } = useI18n()
  const { items, dialogs, launch } = useQuizCardActions(quiz, isOwner, isFavorite)
  const title = quiz.title || t('quizzes.untitled')
  const href = isOwner ? `/editor/${quiz.id}` : `/quiz/${quiz.id}`
  const tags = quiz.quiz_tags?.slice(0, 3) ?? []

  const menu = (
    <Menu
      items={items}
      trigger={(props) => <IconButton {...props} label={t('common.more')} icon={<MoreHorizontal className="size-5" />} size="sm" />}
    />
  )

  const actions = (
    <>
      <Button
        size="sm"
        icon={<Play className="size-4" />}
        loading={launch.isPending}
        onClick={() => launch.mutate(quiz.id)}
        disabled={quiz.question_count === 0}
      >
        {t('common.launch')}
      </Button>
      {isOwner && (
        <Link to={href} className="relative z-10 inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg">
          <Pencil className="size-4" />
          {t('common.edit')}
        </Link>
      )}
    </>
  )

  if (layout === 'list') {
    return (
      <li className="group relative flex items-center gap-4 rounded-md border-2 border-line bg-surface p-2.5 transition-colors duration-150 hover:border-fg-subtle">
        <QuizCover
          color={quiz.cover_color}
          pattern={quiz.cover_pattern}
          imagePath={quiz.cover_image_path}
          title={title}
          className="w-28 shrink-0 rounded-sm border-2 border-edge [&_span]:text-6xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link to={href} className="truncate font-display text-lg font-bold after:absolute after:inset-0 hover:underline">
              {title}
            </Link>
            {isFavorite && <Star className="size-4 shrink-0 fill-amber text-warning-ink" aria-label={t('nav.favorites')} />}
            {isOwner && <StatusBadges quiz={quiz} />}
          </div>
          <MetaLine quiz={quiz} isOwner={isOwner} />
        </div>
        <div className="relative z-10 hidden items-center gap-1 sm:flex">{actions}</div>
        <div className="relative z-10">{menu}</div>
        {dialogs}
      </li>
    )
  }

  return (
    <li
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border-2 border-edge bg-surface',
        'transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:-rotate-[0.6deg] hover:shadow-block',
      )}
    >
      <QuizCover
        color={quiz.cover_color}
        pattern={quiz.cover_pattern}
        imagePath={quiz.cover_image_path}
        title={title}
        className="border-b-2 border-edge"
      >
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">{isOwner && <StatusBadges quiz={quiz} />}</div>
        {isFavorite && (
          <Star className="absolute top-2.5 right-2.5 size-5 fill-amber text-edge" aria-label={t('nav.favorites')} />
        )}
      </QuizCover>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={href} className="line-clamp-2 font-display text-lg leading-snug font-bold after:absolute after:inset-0 focus-visible:outline-none">
          {title}
        </Link>
        <MetaLine quiz={quiz} isOwner={isOwner} />
        {tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label={t('editor.meta.tags')}>
            {tags.map(({ tag }) => (
              <li key={tag} className="text-xs font-semibold text-fg-subtle">
                #{tag}
              </li>
            ))}
          </ul>
        )}
        <div className="relative z-10 mt-auto flex items-center gap-1 pt-2">
          {actions}
          <div className="ml-auto">{menu}</div>
        </div>
      </div>
      {dialogs}
    </li>
  )
})

export function QuizCardSkeleton({ layout = 'grid' }: { layout?: 'grid' | 'list' }) {
  if (layout === 'list') return <li className="skeleton h-[76px] rounded-md" aria-hidden="true" />
  return (
    <li className="overflow-hidden rounded-lg border-2 border-line" aria-hidden="true">
      <div className="skeleton aspect-[16/9]" />
      <div className="flex flex-col gap-2 p-4">
        <div className="skeleton h-5 w-3/4 rounded-sm" />
        <div className="skeleton h-3 w-1/2 rounded-sm" />
        <div className="skeleton mt-3 h-8 w-24 rounded-sm" />
      </div>
    </li>
  )
}
