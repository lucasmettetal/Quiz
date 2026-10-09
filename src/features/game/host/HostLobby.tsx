import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Lock, LockOpen, Play, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { CopyButton } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { formatPin } from '@/lib/format'
import { COLOR_CLASSES } from '@/lib/palette'
import { toAppError } from '@/lib/errors'
import { useT } from '@/i18n/I18nProvider'
import type { GameSession, Player } from '@/types/database'
import { QrCode, tiltFor } from '../components/GameBits'

interface HostLobbyProps {
  session: GameSession
  players: Player[]
  onlinePlayerIds: ReadonlySet<string>
  onStart: () => void
  starting: boolean
  startError: unknown
  onKick: (player: Player) => Promise<unknown>
  onLock: (locked: boolean) => void
}

export function HostLobby({ session, players, onlinePlayerIds, onStart, starting, startError, onKick, onLock }: HostLobbyProps) {
  const t = useT()
  const [kickTarget, setKickTarget] = useState<Player | null>(null)
  const joinUrl = `${window.location.origin}/join/${session.pin}`
  const displayHost = `${window.location.host}/join`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-6 sm:px-8 lg:gap-10">
      {/* Join instructions: readable from the back of the room */}
      <section className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div className="text-center lg:text-left">
          <p className="text-[clamp(1.1rem,2vw,1.75rem)] font-semibold text-paper/75">
            {t('host.joinAt')} <span className="font-display font-extrabold text-paper">{displayHost}</span> {t('host.withPin')}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <p
              aria-label={`PIN ${session.pin}`}
              className="-rotate-2 rounded-lg border-[4px] border-black bg-lime px-6 py-2 font-display text-[clamp(3.5rem,11vw,9rem)] leading-none font-black tracking-[0.06em] text-ink shadow-[8px_8px_0_0_#000] tabular"
            >
              {formatPin(session.pin)}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
            <CopyButton value={session.pin} label={t('host.copyPin')} variant="paper" size="sm" />
            <CopyButton value={joinUrl} label={t('host.copyLink')} variant="paper" size="sm" />
            <Button
              size="sm"
              variant="paper"
              icon={session.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
              aria-pressed={session.locked}
              onClick={() => onLock(!session.locked)}
            >
              {session.locked ? t('host.unlock') : t('host.lock')}
            </Button>
          </div>
        </div>
        <div className="mx-auto hidden rotate-2 rounded-lg border-[4px] border-black bg-paper p-3 shadow-[8px_8px_0_0_#000] sm:block">
          <QrCode value={joinUrl} label={t('host.qrLabel')} className="size-44 lg:size-56" />
        </div>
      </section>

      {/* Roster */}
      <section className="flex min-h-0 flex-1 flex-col rounded-lg border-2 border-white/10 bg-white/[0.04] p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-3 font-display text-3xl font-extrabold" aria-live="polite">
            <Users className="size-8 text-lime" aria-hidden="true" />
            <motion.span key={players.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="inline-block tabular">
              {players.length}
            </motion.span>
            <span className="text-xl font-bold text-paper/70">{t('host.playersWord', { count: players.length })}</span>
            {session.locked && <span className="rounded-sm bg-amber px-2 py-0.5 text-sm font-bold text-ink">{t('host.locked')}</span>}
          </p>
          <div className="flex flex-col items-end gap-1">
            <Button size="xl" variant="primary" icon={<Play className="size-6" />} onClick={onStart} loading={starting} disabled={players.length === 0}>
              {t('host.start')}
            </Button>
            {startError ? <p role="alert" className="text-sm text-amber">{t(`errors.${toAppError(startError).code}`)}</p> : null}
          </div>
        </div>

        {players.length === 0 ? (
          <div className="grid flex-1 place-items-center py-10 text-center">
            <div>
              <p className="font-display text-3xl font-bold">{t('host.waitingTitle')}</p>
              <p className="mt-2 text-paper/60">{t('host.waitingHint')}</p>
              <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
                {['bg-vermilion', 'bg-cobalt', 'bg-amber', 'bg-teal'].map((c, i) => (
                  <span key={c} className={cn('size-4 animate-bounce rounded-xs', c)} style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <ul className="flex flex-wrap content-start gap-3 overflow-y-auto">
            <AnimatePresence initial={false}>
              {players.map((p) => {
                const c = COLOR_CLASSES[p.avatar]
                const offline = !onlinePlayerIds.has(p.id)
                return (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.4, rotate: -12 }}
                    animate={{ opacity: offline ? 0.6 : 1, scale: 1, rotate: tiltFor(p.id) }}
                    exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  >
                    <button
                      type="button"
                      onClick={() => setKickTarget(p)}
                      aria-label={t('host.kick', { name: p.nickname })}
                      title={offline ? t('host.offline') : t('host.kick', { name: p.nickname })}
                      className={cn(
                        'group relative flex items-center gap-2 rounded-md border-[3px] border-black px-4 py-2 font-display text-xl font-bold shadow-[4px_4px_0_0_#000] transition-transform hover:-translate-y-0.5',
                        c.bg,
                        c.on,
                      )}
                    >
                      {p.nickname}
                      <X className="size-4 opacity-0 transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80" aria-hidden="true" />
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(kickTarget)}
        onClose={() => setKickTarget(null)}
        title={kickTarget ? t('host.kick', { name: kickTarget.nickname }) : ''}
        description={kickTarget ? t('host.kickConfirm', { name: kickTarget.nickname }) : ''}
        confirmLabel={t('common.confirm')}
        onConfirm={() => (kickTarget ? onKick(kickTarget) : undefined)}
      />
    </div>
  )
}
