import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Flame, Home } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { COLOR_CLASSES } from '@/lib/palette'
import { sortLeaderboard } from '@/features/game/engine/events'
import { useT } from '@/i18n/I18nProvider'
import type { GameSession, Player } from '@/types/database'
import { AnimatedNumber } from '../components/GameBits'

function RankDelta({ player }: { player: Player }) {
  if (player.previous_rank === null || player.rank === null || player.previous_rank === player.rank) return null
  const up = player.rank < player.previous_rank
  return (
    <span className={cn('inline-flex items-center font-display text-lg font-black', up ? 'text-lime' : 'text-vermilion')}>
      {up ? <ArrowUp className="size-5" aria-hidden="true" /> : <ArrowDown className="size-5" aria-hidden="true" />}
      {Math.abs(player.previous_rank - player.rank)}
    </span>
  )
}

export function HostLeaderboard({ session, players, onNext, advancing }: { session: GameSession; players: Player[]; onNext: () => void; advancing: boolean }) {
  const t = useT()
  // Rows enter in previous order and slide to their new rank (layout animation).
  const top = sortLeaderboard(players).slice(0, 5)
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-6 sm:px-8">
      <h2 className="text-center text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold">{t('host.leaderboardTitle')}</h2>
      <ol className="mx-auto flex w-full max-w-4xl flex-col gap-3">
        <AnimatePresence>
          {top.map((p, i) => {
            const c = COLOR_CLASSES[p.avatar]
            return (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30, delay: i * 0.06 }}
                className={cn(
                  'flex items-center gap-4 rounded-md border-[3px] border-black px-4 py-3 shadow-[5px_5px_0_0_#000]',
                  i === 0 ? 'bg-paper text-ink' : 'bg-ink-soft text-paper',
                )}
              >
                <span className="w-10 text-center font-display text-3xl font-black tabular">{p.rank ?? '–'}</span>
                <span className={cn('grid size-10 shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-black font-display text-lg font-black', c.bg, c.on)} aria-hidden="true">
                  {p.nickname.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-display text-[clamp(1.25rem,2.4vw,2rem)] font-bold">{p.nickname}</span>
                {p.streak >= 3 && (
                  <span className="hidden items-center gap-1 rounded-sm bg-amber px-2 py-0.5 font-bold text-ink sm:inline-flex">
                    <Flame className="size-4" aria-hidden="true" /> {p.streak}
                  </span>
                )}
                <RankDelta player={p} />
                {p.last_points > 0 && <span className="hidden font-display text-lg font-bold text-teal sm:inline">+{p.last_points}</span>}
                <span className="w-32 text-right font-display text-[clamp(1.5rem,2.6vw,2.25rem)] font-black">
                  <AnimatedNumber value={p.score} />
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ol>
      <div className="mt-auto flex justify-end">
        <Button size="xl" variant="paper" iconRight={<ArrowRight className="size-6" />} onClick={onNext} loading={advancing}>
          {session.current_index >= session.question_count - 1 ? t('host.finalResults') : t('host.nextQuestion')}
        </Button>
      </div>
    </div>
  )
}

const PODIUM = [
  { place: 2, height: 'h-[clamp(7rem,22vh,13rem)]', delay: 0.5, color: 'bg-cobalt text-white' },
  { place: 1, height: 'h-[clamp(10rem,32vh,19rem)]', delay: 1.1, color: 'bg-amber text-ink' },
  { place: 3, height: 'h-[clamp(5rem,15vh,9rem)]', delay: 0, color: 'bg-vermilion text-white' },
]

export function HostPodium({ session, players, onClose, closing }: { session: GameSession; players: Player[]; onClose: () => void; closing: boolean }) {
  const t = useT()
  const ranked = sortLeaderboard(players)
  const finished = session.state === 'FINISHED'
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-6 sm:px-8">
      <Confetti />
      <h2 className="text-center text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold">{finished ? t('host.finishedTitle') : t('host.podiumTitle')}</h2>
      <div className="mx-auto flex min-h-[320px] w-full max-w-4xl flex-1 items-end justify-center gap-3 sm:gap-6">
        {PODIUM.map(({ place, height, delay, color }) => {
          const p = ranked[place - 1]
          return (
            <div key={place} className={cn('flex h-full w-1/3 max-w-60 flex-col items-center justify-end')}>
              {p && (
                <motion.div initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: delay + 0.35, type: 'spring', stiffness: 300, damping: 16 }} className="mb-3 text-center">
                  <p className="font-display text-[clamp(1.25rem,2.6vw,2.25rem)] leading-tight font-black [overflow-wrap:anywhere]">{p.nickname}</p>
                  <p className="font-display text-lg font-bold text-paper/70 tabular">
                    <AnimatedNumber value={p.score} />
                  </p>
                </motion.div>
              )}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay, duration: 0.45, ease: [0.2, 0.9, 0.3, 1.2] }}
                style={{ originY: 1 }}
                className={cn('grid w-full place-items-start justify-center rounded-t-lg border-[4px] border-b-0 border-black pt-3 shadow-[6px_0_0_0_#000]', height, color)}
              >
                <span className="font-display text-[clamp(3rem,7vw,6rem)] leading-none font-black">{place}</span>
              </motion.div>
            </div>
          )
        })}
      </div>
      {ranked.length > 3 && (
        <ol className="mx-auto mt-4 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-1 text-paper/75" start={4}>
          {ranked.slice(3, 10).map((p) => (
            <li key={p.id} className="font-semibold">
              <span className="font-display font-black tabular">{p.rank}.</span> {p.nickname} · <span className="tabular">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {finished ? (
          <>
            <ButtonLink to="/app" variant="paper" size="lg" icon={<Home className="size-5" />}>
              {t('host.backToDashboard')}
            </ButtonLink>
            <ButtonLink to={`/app/results/${session.id}`} size="lg" icon={<BarChart3 className="size-5" />}>
              {t('host.viewReport')}
            </ButtonLink>
          </>
        ) : (
          <Button size="xl" variant="paper" onClick={onClose} loading={closing}>
            {t('host.close')}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Brand confetti: tilted squares in the six answer colors, CSS-only. */
function Confetti() {
  const colors = ['bg-vermilion', 'bg-cobalt', 'bg-lime', 'bg-amber', 'bg-teal', 'bg-orchid']
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {Array.from({ length: 36 }, (_, i) => (
        <span
          key={i}
          className={cn('absolute -top-6 size-3 rounded-[2px] animate-[confetti-fall_linear_infinite]', colors[i % colors.length])}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDuration: `${3.5 + ((i * 13) % 30) / 10}s`,
            animationDelay: `${1.4 + ((i * 7) % 25) / 10}s`,
            transform: `rotate(${i * 29}deg)`,
          }}
        />
      ))}
    </div>
  )
}
