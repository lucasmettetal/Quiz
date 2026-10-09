import { motion } from 'motion/react'
import { Check, Keyboard, SkipForward, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AnswerTile } from '@/features/game/components/AnswerTile'
import { answerDistribution, type ChoiceBucket } from '@/features/results/stats'
import { useCountdown } from '@/hooks/useCountdown'
import { cn } from '@/lib/cn'
import { answerSlot, type AnswerSlot } from '@/lib/palette'
import { mediaPublicUrl } from '@/lib/supabase'
import { useT } from '@/i18n/I18nProvider'
import type { GameSession, PlayerAnswer } from '@/types/database'
import { AnimatedNumber, CountdownRing } from '../components/GameBits'
import { INTRO_DURATION_MS, type HostQuestion as HostQuestionData } from './useHostGame'

interface Props {
  session: GameSession
  question: HostQuestionData
  answers: PlayerAnswer[]
  playerCount: number
  clockOffset: number
  onNext: () => void
  advancing: boolean
}

function ProgressPill({ session }: { session: GameSession }) {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-2 rounded-sm bg-white/10 px-3 py-1 font-display text-lg font-bold tabular">
      {t('host.questionOf', { n: session.current_index + 1, total: session.question_count })}
    </span>
  )
}

export function HostQuestionIntro({ session, question }: Pick<Props, 'session' | 'question'>) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <motion.div initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: -3, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
        <ProgressPill session={session} />
      </motion.div>
      <motion.h2
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.1 }}
        className="max-w-5xl text-[clamp(2rem,5vw,4.5rem)] leading-[1.05] font-extrabold"
      >
        {question.prompt}
      </motion.h2>
      <div className="h-3 w-full max-w-xl overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <div className="h-full origin-left animate-[intro-bar_linear_forwards] rounded-full bg-lime" style={{ animationDuration: `${INTRO_DURATION_MS}ms` }} />
      </div>
    </div>
  )
}

function slotsFor(question: HostQuestionData, labels: { true: string; false: string }): Array<{ key: string; label: string; slot: AnswerSlot }> {
  if (question.type === 'quiz' || question.type === 'poll') {
    return question.content.options.map((o, i) => ({ key: o.id, label: o.text, slot: answerSlot(i) }))
  }
  if (question.type === 'true_false') {
    return [
      { key: 'true', label: labels.true, slot: { color: 'teal', pattern: 'waves', letter: labels.true.charAt(0) } },
      { key: 'false', label: labels.false, slot: { color: 'vermilion', pattern: 'stripes', letter: labels.false.charAt(0) } },
    ]
  }
  return []
}

export function HostQuestionLive({ session, question, answers, playerCount, clockOffset, onNext, advancing, revealed }: Props & { revealed: boolean }) {
  const t = useT()
  const left = useCountdown(session.question_deadline, clockOffset, !revealed)
  const labels = { true: t('questionTypes.trueFalse.true'), false: t('questionTypes.trueFalse.false') }
  const tiles = slotsFor(question, labels)
  const distribution = revealed ? answerDistribution(question, answers, labels) : []
  const byKey = new Map(distribution.map((b) => [b.key, b]))
  const maxCount = Math.max(1, ...distribution.map((b) => b.count))
  const image = mediaPublicUrl(question.media?.path)
  const correctCount = answers.filter((a) => a.is_correct).length
  const isPoll = question.type === 'poll'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 sm:px-8 sm:pb-6 lg:gap-6">
      {/* 1. progress  2. question */}
      <div className="flex items-start gap-4">
        <ProgressPill session={session} />
        <div className="ml-auto flex items-center gap-3">
          {!revealed && (
            <Button variant="paper" size="sm" icon={<SkipForward className="size-4" />} onClick={onNext} loading={advancing}>
              {t('host.skip')}
            </Button>
          )}
        </div>
      </div>
      <h2 className="text-center text-[clamp(1.75rem,3.6vw,3.5rem)] leading-[1.08] font-extrabold">{question.prompt}</h2>

      {/* 3. media · 5. timer · 6. answers received */}
      <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-4 lg:gap-8">
        <div className="flex w-28 justify-center lg:w-40">
          {revealed ? (
            <span className="font-display text-2xl font-black text-lime">{isPoll ? '' : t('host.timeUp')}</span>
          ) : (
            <CountdownRing remainingMs={left} totalMs={question.time_limit_s * 1000} size={150} className="max-lg:scale-75" />
          )}
        </div>
        <div className="flex min-h-0 justify-center self-stretch">
          {image ? (
            <img src={image} alt={question.media?.alt ?? ''} className="max-h-[32vh] min-h-0 rounded-md border-[3px] border-black object-contain" />
          ) : question.type === 'text' && !revealed ? (
            <div className="grid place-items-center text-center text-paper/70">
              <Keyboard className="mx-auto size-16" aria-hidden="true" />
              <p className="mt-2 font-display text-2xl font-bold">{t('player.typeAnswer')}</p>
            </div>
          ) : null}
        </div>
        <div className="flex w-28 flex-col items-center text-center lg:w-40" aria-live="polite">
          <span className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-none font-black">
            <AnimatedNumber value={answers.length} duration={250} />
          </span>
          <span className="text-sm font-semibold text-paper/70">
            {t('host.answersWord', { count: answers.length })} / {playerCount}
          </span>
        </div>
      </div>

      {/* 4. answers */}
      {question.type === 'text' && revealed ? (
        <TextResults question={question} distribution={distribution} />
      ) : tiles.length > 0 ? (
        <div className={cn('grid gap-3 lg:gap-4', tiles.length > 2 ? 'sm:grid-cols-2' : 'grid-cols-2')}>
          {tiles.map(({ key, label, slot }) => {
            const bucket = byKey.get(key)
            const state = !revealed ? 'idle' : isPoll ? 'idle' : bucket?.correct ? 'correct' : 'dimmed'
            return (
              <div key={key} className="relative">
                <AnswerTile asStatic look={slot} label={label} size="stage" state={state} trailing={revealed && bucket ? <span className="font-display text-[clamp(1.5rem,2.6vw,2.5rem)] font-black tabular">{bucket.count}</span> : undefined} />
                {revealed && bucket && (
                  <div className="absolute inset-x-3 bottom-1.5 h-1.5 overflow-hidden rounded-full bg-black/25" aria-hidden="true">
                    <motion.div className="h-full rounded-full bg-white" initial={{ width: 0 }} animate={{ width: `${(bucket.count / maxCount) * 100}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {revealed && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl font-bold text-paper/80">
            {isPoll ? '' : answers.length === 0 ? t('host.nobodyAnswered') : t('host.correctCount', { count: correctCount, total: playerCount })}
          </p>
          <Button size="xl" variant="paper" icon={<Trophy className="size-6" />} onClick={onNext} loading={advancing}>
            {session.current_index >= session.question_count - 1 ? t('host.finalResults') : t('host.showLeaderboard')}
          </Button>
        </div>
      )}
    </div>
  )
}

function TextResults({ question, distribution }: { question: HostQuestionData; distribution: ChoiceBucket[] }) {
  const t = useT()
  if (question.type !== 'text') return null
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rotate-[-1deg] rounded-lg border-[3px] border-black bg-teal p-5 text-white shadow-[6px_6px_0_0_#000]">
        <p className="text-sm font-bold tracking-widest uppercase opacity-80">{t('host.acceptedAnswers')}</p>
        <p className="mt-1 font-display text-[clamp(1.75rem,3vw,3rem)] leading-tight font-black">{question.content.accepted.filter(Boolean).join(' · ')}</p>
      </div>
      <div className="rounded-lg border-2 border-white/15 bg-white/5 p-5">
        <p className="mb-2 text-sm font-bold tracking-widest text-paper/70 uppercase">{t('host.textAnswersTitle')}</p>
        {distribution.length === 0 ? (
          <p className="text-paper/60">{t('host.nobodyAnswered')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {distribution.map((b) => (
              <li key={b.key} className="flex items-center gap-3 font-display text-xl font-bold">
                {b.correct ? <Check className="size-5 text-lime" aria-label={t('host.correctAnswer')} /> : <X className="size-5 text-vermilion" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
                <span className="tabular">{b.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
