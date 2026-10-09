import { useEffect, useState } from 'react'
import { Maximize, Minimize, Power, WifiOff } from 'lucide-react'
import { useParams } from 'react-router'
import { IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Logo } from '@/components/ui/Logo'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { HostLeaderboard, HostPodium } from '@/features/game/host/HostLeaderboard'
import { HostLobby } from '@/features/game/host/HostLobby'
import { HostQuestionIntro, HostQuestionLive } from '@/features/game/host/HostQuestion'
import { useHostGame } from '@/features/game/host/useHostGame'
import { formatPin } from '@/lib/format'
import { useT } from '@/i18n/I18nProvider'

function useFullscreen() {
  const [on, setOn] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement))
  useEffect(() => {
    const onChange = () => setOn(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggle = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)
  return { on, toggle, supported: typeof document !== 'undefined' && document.fullscreenEnabled }
}

export function HostPage() {
  const { sessionId = '' } = useParams()
  const t = useT()
  const game = useHostGame(sessionId)
  const fullscreen = useFullscreen()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const session = game.session.data

  useEffect(() => {
    if (session) document.title = `${formatPin(session.pin)} · ${session.quiz_title} — Tilt`
    return () => {
      document.title = 'Tilt'
    }
  }, [session])

  if (game.session.isError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <ErrorState error={game.session.error} title={t('host.notFoundTitle')} />
      </div>
    )
  }
  if (!session || !game.players.data || !game.questions.data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-stage text-lime">
        <Spinner className="size-12" label={t('host.preparing')} />
      </div>
    )
  }

  const next = () => game.advance.mutate(session.state)
  const advancing = game.advance.isPending
  const live = session.state !== 'FINISHED'

  let screen: React.ReactNode = null
  switch (session.state) {
    case 'LOBBY':
      screen = (
        <HostLobby
          session={session}
          players={game.activePlayers}
          onlinePlayerIds={game.onlinePlayerIds}
          onStart={next}
          starting={advancing}
          startError={game.advance.error}
          onKick={(p) => game.kick.mutateAsync(p.id)}
          onLock={(locked) => game.lock.mutate(locked)}
        />
      )
      break
    case 'QUESTION_INTRO':
      if (game.current) screen = <HostQuestionIntro session={session} question={game.current} />
      break
    case 'QUESTION_ACTIVE':
    case 'QUESTION_RESULTS':
      if (game.current)
        screen = (
          <HostQuestionLive
            key={game.current.id}
            session={session}
            question={game.current}
            answers={game.answers}
            playerCount={game.activePlayers.length}
            clockOffset={game.clockOffset}
            onNext={next}
            advancing={advancing}
            revealed={session.state === 'QUESTION_RESULTS'}
          />
        )
      break
    case 'LEADERBOARD':
      screen = <HostLeaderboard session={session} players={game.players.data} onNext={next} advancing={advancing} />
      break
    case 'FINAL_RESULTS':
    case 'FINISHED':
      screen = <HostPodium session={session} players={game.players.data} onClose={next} closing={advancing} />
      break
  }

  return (
    <div className="flex min-h-dvh flex-col bg-stage text-stage-fg">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-8">
        <Logo className="text-2xl text-paper" />
        <span className="hidden min-w-0 truncate font-semibold text-paper/60 sm:inline">{session.quiz_title}</span>
        <div className="ml-auto flex items-center gap-2">
          {session.state !== 'LOBBY' && live && (
            <span className="rounded-sm bg-white/10 px-2.5 py-1 font-display text-sm font-bold tabular">PIN {formatPin(session.pin)}</span>
          )}
          {game.connection === 'disconnected' && (
            <span role="status" className="inline-flex items-center gap-1.5 rounded-sm bg-amber px-2.5 py-1 text-sm font-bold text-ink">
              <WifiOff className="size-4" aria-hidden="true" /> {t('host.connectionLost')}
            </span>
          )}
          {fullscreen.supported && (
            <IconButton
              label={fullscreen.on ? t('host.exitFullscreen') : t('host.fullscreen')}
              icon={fullscreen.on ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
              onClick={fullscreen.toggle}
              className="text-paper/70 hover:bg-white/10 hover:text-paper"
            />
          )}
          {live && (
            <IconButton label={t('host.end')} icon={<Power className="size-5" />} onClick={() => setConfirmEnd(true)} className="text-paper/70 hover:bg-white/10 hover:text-vermilion" />
          )}
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{screen}</main>
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title={t('host.endConfirmTitle')}
        description={t('host.endConfirmText')}
        confirmLabel={t('host.end')}
        onConfirm={() => game.end.mutateAsync()}
      />
    </div>
  )
}
