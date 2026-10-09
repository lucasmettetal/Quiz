import { useState } from 'react'
import { LogOut, WifiOff } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import {
  FeedbackScreen,
  FinalScreen,
  IntroScreen,
  KickedScreen,
  LeaderboardScreen,
  LobbyScreen,
  QuestionScreen,
} from '@/features/game/player/PlayerScreens'
import { usePlayerGame } from '@/features/game/player/usePlayerGame'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'

export function PlayPage() {
  const { sessionId = '' } = useParams()
  const t = useT()
  const navigate = useNavigate()
  const game = usePlayerGame(sessionId)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const view = game.view.data

  if (game.view.isError) {
    const { code } = toAppError(game.view.error)
    // Not (or no longer) in this game: back to the join screen.
    if (code === 'NOT_IN_GAME' || code === 'NOT_AUTHENTICATED') return <Navigate to="/join" replace />
    return (
      <div className="grid min-h-dvh place-items-center bg-stage text-stage-fg">
        <ErrorState error={game.view.error} onRetry={() => game.view.refetch()} />
      </div>
    )
  }
  if (!view) {
    return (
      <div className="grid min-h-dvh place-items-center bg-stage text-lime">
        <Spinner className="size-12" label={t('common.loading')} />
      </div>
    )
  }

  let screen: React.ReactNode
  if (view.player.status === 'kicked') screen = <KickedScreen />
  else
    switch (view.session.state) {
      case 'LOBBY':
        screen = <LobbyScreen view={view} onlineCount={0} />
        break
      case 'QUESTION_INTRO':
        screen = <IntroScreen view={view} />
        break
      case 'QUESTION_ACTIVE':
        screen = view.question ? (
          <QuestionScreen
            key={view.question.id}
            view={view}
            submitted={game.submitted}
            onAnswer={(answer) => game.answer(view.question!.id, answer)}
            errorText={game.submitError ? t(`errors.${game.submitError.code}`) : null}
          />
        ) : null
        break
      case 'QUESTION_RESULTS':
        screen = <FeedbackScreen view={view} />
        break
      case 'LEADERBOARD':
        screen = <LeaderboardScreen view={view} />
        break
      default:
        screen = <FinalScreen view={view} />
    }

  const inGame = view.player.status !== 'kicked' && view.session.state !== 'FINAL_RESULTS' && view.session.state !== 'FINISHED'

  return (
    <div className="flex min-h-dvh flex-col bg-stage">
      {(game.connection === 'disconnected' || game.hostAway) && (
        <p role="status" className="flex items-center justify-center gap-2 bg-amber px-4 py-2 text-center text-sm font-bold text-ink">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          {game.connection === 'disconnected' ? t('player.reconnecting') : t('player.hostAway')}
        </p>
      )}
      <main className="relative flex flex-1 flex-col">
        {screen}
        {inGame && view.session.state === 'LOBBY' && (
          <div className="absolute top-3 right-3">
            <IconButton
              label={t('player.leave')}
              icon={<LogOut className="size-5" />}
              onClick={() => setConfirmLeave(true)}
              className="text-paper/60 hover:bg-white/10 hover:text-paper"
            />
          </div>
        )}
      </main>
      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={t('player.leave')}
        description={t('player.leaveConfirm')}
        confirmLabel={t('player.leave')}
        onConfirm={async () => {
          await game.leave.mutateAsync()
          navigate('/join', { replace: true })
        }}
      />
    </div>
  )
}
