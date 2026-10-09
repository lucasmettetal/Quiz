import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, Globe, Play, Settings2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { toast } from '@/components/ui/Toaster'
import { Badge } from '@/components/ui/misc'
import { PreviewDialog } from '@/features/editor/PreviewDialog'
import { PublishDialog } from '@/features/editor/PublishDialog'
import { QuestionCanvas } from '@/features/editor/QuestionCanvas'
import { QuestionList } from '@/features/editor/QuestionList'
import { QuestionSettingsPanel } from '@/features/editor/QuestionSettingsPanel'
import { QuizSettingsDialog } from '@/features/editor/QuizSettingsDialog'
import { SaveIndicator } from '@/features/editor/SaveIndicator'
import { TypePickerDialog } from '@/features/editor/TypePickerDialog'
import { useEditorSession } from '@/features/editor/useEditorSession'
import { useLaunchQuiz } from '@/features/quizzes/useLaunchQuiz'
import { useEditorStore } from '@/stores/editorStore'
import { useAuth } from '@/features/auth/AuthProvider'
import { AppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

export function EditorPage() {
  const { quizId = '' } = useParams()
  const t = useT()
  const navigate = useNavigate()
  const session = useEditorSession(quizId)
  const { profile } = useAuth()
  const launch = useLaunchQuiz()
  const [dialog, setDialog] = useState<'type' | 'settings' | 'preview' | 'publish' | null>(null)

  const title = useEditorStore((s) => s.meta.title)
  const setMeta = useEditorStore((s) => s.setMeta)
  const addQuestion = useEditorStore((s) => s.addQuestion)
  const status = useEditorStore((s) => s.status)
  const visibility = useEditorStore((s) => s.visibility)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const hasQuestions = useEditorStore((s) => s.questions.length > 0)

  useEffect(() => {
    if (session.restoredDraft) toast({ message: t('editor.restoredDraft') })
  }, [session.restoredDraft, t])

  useEffect(() => {
    document.title = `${title || t('quizzes.untitled')} — Tilt`
    return () => {
      document.title = 'Tilt'
    }
  }, [title, t])

  if (session.query.isError) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={session.query.error} title={t('editor.notFoundTitle')} />
      </div>
    )
  }
  if (session.query.data && session.query.data.quiz.owner_id !== profile?.id) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={new AppError('NOT_AUTHORIZED')} title={t('editor.notFoundTitle')} />
      </div>
    )
  }
  if (!session.ready) return <FullPageSpinner label={t('common.loading')} />

  async function handleLaunch() {
    await session.flush()
    launch.mutate(quizId)
  }

  async function handleBack() {
    await session.flush()
    navigate('/app/quizzes')
  }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b-2 border-line bg-surface px-2 sm:gap-3 sm:px-4">
        <IconButton label={t('editor.back')} icon={<ArrowLeft className="size-5" />} onClick={handleBack} />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            value={title}
            onChange={(e) => setMeta({ title: e.target.value })}
            maxLength={120}
            placeholder={t('editor.titlePlaceholder')}
            aria-label={t('editor.meta.title')}
            className="w-full min-w-0 rounded-sm bg-transparent px-2 py-1 font-display text-lg font-bold placeholder:text-fg-subtle hover:bg-surface-2 focus:bg-surface-2 focus:outline-none sm:max-w-md sm:text-xl"
          />
          <span className="hidden md:inline">{status === 'published' ? <Badge tone="success">{t(`quizzes.visibility.${visibility}`)}</Badge> : <Badge tone="ink">{t('quizzes.draft')}</Badge>}</span>
          <SaveIndicator />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <IconButton label={t('common.preview')} icon={<Eye className="size-5" />} onClick={() => setDialog('preview')} disabled={!hasQuestions} />
          <IconButton label={t('editor.settingsTitle')} icon={<Settings2 className="size-5" />} onClick={() => setDialog('settings')} />
          <span className="hidden sm:contents">
            <Button variant="secondary" icon={<Globe className="size-4" />} onClick={() => setDialog('publish')}>
              {t('editor.publish')}
            </Button>
          </span>
          <Button icon={<Play className="size-4" />} onClick={handleLaunch} loading={launch.isPending} disabled={!hasQuestions}>
            <span className="hidden sm:inline">{t('editor.launch')}</span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="h-60 shrink-0 overflow-hidden border-b-2 border-line bg-surface lg:h-auto lg:w-64 lg:border-r-2 lg:border-b-0">
          <QuestionList onAdd={() => setDialog('type')} />
        </div>
        <main className="shrink-0 bg-surface-2/50 lg:min-h-0 lg:flex-1 lg:shrink lg:overflow-y-auto">
          <QuestionCanvas onAdd={() => setDialog('type')} />
        </main>
        <div className="shrink-0 border-t-2 border-line bg-surface lg:w-72 lg:overflow-y-auto lg:border-t-0 lg:border-l-2">
          <QuestionSettingsPanel />
          <div className="border-t-2 border-line p-4 sm:hidden">
            <Button variant="secondary" className="w-full" icon={<Globe className="size-4" />} onClick={() => setDialog('publish')}>
              {t('editor.publish')}
            </Button>
          </div>
        </div>
      </div>

      <TypePickerDialog open={dialog === 'type'} onClose={() => setDialog(null)} onPick={addQuestion} />
      <QuizSettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} />
      <PreviewDialog open={dialog === 'preview'} onClose={() => setDialog(null)} />
      {dialog === 'publish' && <PublishDialog open onClose={() => setDialog(null)} flush={session.flush} />}

      <Dialog
        open={saveStatus === 'conflict'}
        onClose={() => undefined}
        dismissible={false}
        title={t('editor.conflictTitle')}
        description={t('editor.conflictText')}
        footer={
          <>
            <Button variant="secondary" onClick={session.reloadFromServer}>
              {t('editor.conflictReload')}
            </Button>
            <Button variant="danger" onClick={() => void session.overwriteServer()}>
              {t('editor.conflictOverwrite')}
            </Button>
          </>
        }
      />
    </div>
  )
}
