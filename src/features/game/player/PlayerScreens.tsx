import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, Check, Clock, Flame, Hourglass, Medal, Minus, Send, UserX, X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES } from '@/lib/palette'
import { mediaPublicUrl } from '@/lib/supabase'
import { PlayerAnswerInput } from '@/features/questions/ui/PlayerInputs'
import type { AnyAnswer } from '@/features/questions/model'
import type { PlayerView } from '@/services/play'
import { useCountdown } from '@/hooks/useCountdown'
import { useT } from '@/i18n/I18nProvider'
import { AnimatedNumber, CountdownBar } from '../components/GameBits'
import { PersonAvatar } from '@/features/avatars/AvatarFace'

type View = PlayerView

/** Full-height panel; `tone` colors the whole screen so feedback reads at a glance. */
export function Screen({ tone = 'stage', children, className }: { tone?: 'stage' | 'success' | 'danger' | 'amber'; children: ReactNode; className?: string }) {
  const tones = { stage: 'bg-stage text-stage-fg', success: 'bg-success text-white', danger: 'bg-danger text-white', amber: 'bg-amber text-ink' }
  return <div className={cn('flex flex-1 flex-col px-5 py-5 transition-colors duration-300', tones[tone], className)}>{children}</div>
}

function Big({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('font-display text-[clamp(2rem,9vw,3rem)] leading-[1.05] font-black', className)}>{children}</p>
}

export function PlayerBadge({ view }: { view: View }) {
  const c = COLOR_CLASSES[view.player.avatar]
  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 truncate rounded-sm border-2 border-black py-0.5 pr-2.5 pl-0.5 font-display font-bold', c.bg, c.on)}>
      <PersonAvatar config={view.player.avatar_config} name={view.player.nickname} size={24} />
      {view.player.nickname}
    </span>
  )
}

export function LobbyScreen({ view, onlineCount }: { view: View; onlineCount: number }) {
  const t = useT()
  const c = COLOR_CLASSES[view.player.avatar]
  return (
    <Screen className="items-center justify-center gap-8 text-center">
      <motion.div
        initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 15 }}
        className={cn('flex max-w-full flex-col items-center gap-2 rounded-lg border-[4px] border-black px-6 pt-5 pb-4 shadow-[7px_7px_0_0_#000]', c.bg, c.on)}
      >
        <PersonAvatar config={view.player.avatar_config} name={view.player.nickname} size={112} />
        <p className="font-display text-[clamp(1.75rem,9vw,3rem)] leading-none font-black [overflow-wrap:anywhere]">{view.player.nickname}</p>
      </motion.div>
      <div>
        <Big>{t('player.lobbyTitle')}</Big>
        <p className="mt-2 text-lg text-paper/70">{t('player.lobbyHint')}</p>
      </div>
      <p className="text-sm font-semibold text-paper/60" aria-live="polite">
        {t('player.lobbyPlayers', { count: Math.max(onlineCount, view.player_count) })}
      </p>
    </Screen>
  )
}

export function IntroScreen({ view }: { view: View }) {
  const t = useT()
  return (
    <Screen className="items-center justify-center gap-6 text-center">
      <motion.p
        initial={{ scale: 0.4, rotate: -12 }}
        animate={{ scale: 1, rotate: -3 }}
        transition={{ type: 'spring', stiffness: 420, damping: 14 }}
        className="rounded-md border-[3px] border-black bg-lime px-4 py-2 font-display text-3xl font-black text-ink shadow-[5px_5px_0_0_#000]"
      >
        {t('player.getReady', { n: view.session.current_index + 1 })}
      </motion.p>
      {view.question && <p className="font-display text-2xl leading-tight font-bold">{view.question.prompt}</p>}
    </Screen>
  )
}

export function QuestionScreen({
  view,
  submitted,
  onAnswer,
  errorText,
}: {
  view: View
  submitted: AnyAnswer | null
  onAnswer: (answer: AnyAnswer) => void
  errorText: string | null
}) {
  const t = useT()
  const q = view.question!
  const left = useCountdown(view.session.question_deadline, view.clockOffset)
  const timeUp = left <= 0
  const image = mediaPublicUrl(q.media?.path)

  if (submitted) {
    return (
      <Screen className="items-center justify-center gap-5 text-center">
        <motion.div initial={{ scale: 0.3, rotate: -30 }} animate={{ scale: 1, rotate: -6 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} className="grid size-24 place-items-center rounded-lg border-[4px] border-black bg-lime text-ink shadow-[6px_6px_0_0_#000]">
          <Send className="size-11" aria-hidden="true" />
        </motion.div>
        <Big>{t('player.answerSent')}</Big>
        <p className="text-lg text-paper/70">{t('player.answerSentHint')}</p>
        {errorText && <p role="alert" className="rounded-md bg-amber px-3 py-2 font-semibold text-ink">{errorText}</p>}
      </Screen>
    )
  }

  if (timeUp) {
    return (
      <Screen className="items-center justify-center gap-5 text-center">
        <Hourglass className="size-20 text-amber" aria-hidden="true" />
        <Big>{t('player.timeUp')}</Big>
        <p className="text-lg text-paper/70">{t('player.timeUpHint')}</p>
      </Screen>
    )
  }

  return (
    <Screen className="gap-4">
      <div className="flex items-center justify-between gap-3 text-sm font-bold text-paper/70">
        <span className="tabular">{t('player.questionOf', { n: view.session.current_index + 1, total: view.session.question_count })}</span>
        <PlayerBadge view={view} />
      </div>
      <CountdownBar remainingMs={left} totalMs={q.time_limit_s * 1000} />
      <h1 className="text-center font-display text-[clamp(1.35rem,5.5vw,2rem)] leading-tight font-bold">{q.prompt}</h1>
      {image && <img src={image} alt={q.media?.alt ?? ''} className="mx-auto max-h-[22vh] rounded-md border-2 border-black object-contain" />}
      <div className="mt-auto pb-[env(safe-area-inset-bottom)]">
        {errorText && <p role="alert" className="mb-3 rounded-md bg-amber px-3 py-2 text-center font-semibold text-ink">{errorText}</p>}
        <PlayerAnswerInput question={q} submitted={null} onSubmit={onAnswer} />
      </div>
    </Screen>
  )
}

function RankLine({ view }: { view: View }) {
  const t = useT()
  const { rank, previous_rank } = view.player
  if (!rank) return null
  const delta = previous_rank ? previous_rank - rank : 0
  const label = rank === 1 ? t('player.rankFirst', { total: view.player_count }) : t('player.rankOf', { rank, total: view.player_count })
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="font-display text-2xl font-black">{label}</p>
      {previous_rank !== null && (
        <p className="inline-flex items-center gap-1 text-sm font-bold opacity-85">
          {delta > 0 ? <ArrowUp className="size-4" aria-hidden="true" /> : delta < 0 ? <ArrowDown className="size-4" aria-hidden="true" /> : <Minus className="size-4" aria-hidden="true" />}
          {delta > 0 ? t('player.rankUp', { count: delta }) : delta < 0 ? t('player.rankDown', { count: -delta }) : t('player.rankSame')}
        </p>
      )}
    </div>
  )
}

export function FeedbackScreen({ view }: { view: View }) {
  const t = useT()
  const answer = view.answer
  const poll = view.question?.type === 'poll'
  const outcome: 'poll' | 'correct' | 'wrong' | 'none' = !answer ? 'none' : poll ? 'poll' : answer.is_correct ? 'correct' : 'wrong'
  const tone = outcome === 'correct' ? 'success' : outcome === 'wrong' ? 'danger' : outcome === 'poll' ? 'amber' : 'stage'
  const icon = outcome === 'correct' ? <Check className="size-14" strokeWidth={3.5} /> : outcome === 'wrong' ? <X className="size-14" strokeWidth={3.5} /> : outcome === 'poll' ? <Check className="size-14" strokeWidth={3.5} /> : <Clock className="size-14" />
  const title = { correct: t('player.correct'), wrong: t('player.wrong'), poll: t('player.pollThanks'), none: t('player.timeUp') }[outcome]

  return (
    <Screen tone={tone} className="items-center justify-center gap-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: outcome === 'wrong' ? 25 : -25 }}
        animate={outcome === 'wrong' ? { scale: 1, rotate: [25, -8, 6, -3, 0] } : { scale: [0, 1.2, 1], rotate: -6 }}
        transition={{ duration: 0.45 }}
        className="grid size-28 place-items-center rounded-lg border-[4px] border-black bg-paper text-ink shadow-[7px_7px_0_0_#000]"
        aria-hidden="true"
      >
        {icon}
      </motion.div>
      <Big>{title}</Big>
      {outcome === 'correct' && (
        <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="font-display text-5xl font-black">
          {t('player.pointsGained', { points: answer?.points ?? 0 })}
        </motion.p>
      )}
      {outcome === 'correct' && view.player.streak >= 2 && (
        <p className="inline-flex items-center gap-1.5 rounded-sm bg-black/20 px-3 py-1 font-bold">
          <Flame className="size-5" aria-hidden="true" /> {t('player.streak', { count: view.player.streak })}
        </p>
      )}
      {(outcome === 'wrong' || outcome === 'none') && view.question?.solution && <SolutionHint view={view} />}
      {!poll && (
        <div className="mt-2 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold uppercase opacity-75">{t('player.totalScore')}</p>
          <p className="-mt-2 font-display text-4xl font-black">
            <AnimatedNumber value={view.player.score} />
          </p>
          <RankLine view={view} />
        </div>
      )}
    </Screen>
  )
}

function SolutionHint({ view }: { view: View }) {
  const t = useT()
  const q = view.question
  const s = q?.solution
  if (!q || !s) return null
  let text = ''
  if ('optionIds' in s && (q.type === 'quiz' || q.type === 'poll')) text = q.content.options.filter((o) => s.optionIds.includes(o.id)).map((o) => o.text).join(' · ')
  else if ('value' in s) text = s.value ? t('questionTypes.trueFalse.true') : t('questionTypes.trueFalse.false')
  else if ('accepted' in s) text = s.accepted.join(' · ')
  if (!text) return null
  return (
    <p className="rounded-md bg-black/20 px-4 py-2">
      <span className="text-sm font-semibold opacity-80">{t('player.theAnswerWas')} </span>
      <span className="font-display text-lg font-bold">{text}</span>
    </p>
  )
}

export function LeaderboardScreen({ view }: { view: View }) {
  const t = useT()
  return (
    <Screen className="items-center justify-center gap-6 text-center">
      <PlayerBadge view={view} />
      <Big>{t('player.waitingLeaderboard')}</Big>
      <p className="font-display text-5xl font-black">
        <AnimatedNumber value={view.player.score} />
      </p>
      <RankLine view={view} />
    </Screen>
  )
}

export function FinalScreen({ view }: { view: View }) {
  const t = useT()
  const rank = view.player.rank
  const medal = rank === 1 ? 'bg-amber' : rank === 2 ? 'bg-cobalt text-white' : rank === 3 ? 'bg-vermilion text-white' : 'bg-paper'
  return (
    <Screen className="items-center justify-center gap-6 text-center">
      <Big>{t('player.finalTitle')}</Big>
      {rank && (
        <motion.div
          initial={{ scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: -6 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.2 }}
          className={cn('grid size-36 place-items-center rounded-lg border-[4px] border-black text-ink shadow-[8px_8px_0_0_#000]', medal)}
        >
          <div>
            {rank <= 3 && <Medal className="mx-auto size-8" aria-hidden="true" />}
            <p className="font-display text-5xl font-black">{rank}</p>
          </div>
        </motion.div>
      )}
      <div>
        <p className="font-display text-3xl font-black">{t('player.finalScore', { score: view.player.score })}</p>
        <p className="mt-1 text-paper/70">{t('player.finalCorrect', { correct: view.player.correct_count, total: view.session.question_count })}</p>
        {rank && <p className="mt-1 font-semibold">{rank === 1 ? t('player.rankFirst', { total: view.player_count }) : t('player.rankOf', { rank, total: view.player_count })}</p>}
      </div>
      <ButtonLink to="/join" variant="paper" size="lg">
        {t('player.playAgain')}
      </ButtonLink>
    </Screen>
  )
}

export function KickedScreen() {
  const t = useT()
  return (
    <Screen className="items-center justify-center gap-5 text-center">
      <UserX className="size-20 text-vermilion" aria-hidden="true" />
      <Big>{t('player.kickedTitle')}</Big>
      <p className="text-paper/70">{t('player.kickedText')}</p>
      <ButtonLink to="/join" variant="paper" size="lg">
        {t('player.playAgain')}
      </ButtonLink>
    </Screen>
  )
}
