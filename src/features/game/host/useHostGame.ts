import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { estimateClockOffset, elapsedMs, remainingMs } from '@/features/game/engine/clock'
import { upsertPlayer, type GameEvent } from '@/features/game/engine/events'
import { questionFromRow } from '@/features/questions/registry'
import type { Question } from '@/features/questions/model'
import {
  getSession,
  getSessionAnswers,
  getSessionPlayers,
  getSessionQuestions,
  hostAdvance,
  hostEndGame,
  kickPlayer,
  setSessionLocked,
} from '@/services/games'
import { getServerTime } from '@/services/play'
import { subscribeToGame, type ConnectionStatus } from '@/services/realtime'
import type { GameSession, Player, PlayerAnswer } from '@/types/database'

export const INTRO_DURATION_MS = 3500

export const hostKeys = {
  session: (id: string) => ['host', id, 'session'] as const,
  questions: (id: string) => ['host', id, 'questions'] as const,
  players: (id: string) => ['host', id, 'players'] as const,
  answers: (id: string, questionId: string | undefined) => ['host', id, 'answers', questionId ?? 'none'] as const,
}

export type HostQuestion = Question & { position: number }

/**
 * Everything the presenter screen needs. Snapshots come from queries; realtime
 * events patch them in place; any (re)connection triggers a full resync.
 */
export function useHostGame(sessionId: string) {
  const qc = useQueryClient()
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<ReadonlySet<string>>(new Set())
  const disconnected = connection === 'disconnected'

  const session = useQuery({
    queryKey: hostKeys.session(sessionId),
    queryFn: () => getSession(sessionId),
    // Polling only as a fallback while realtime is down.
    refetchInterval: disconnected ? 3000 : false,
  })
  const questions = useQuery({
    queryKey: hostKeys.questions(sessionId),
    queryFn: async () =>
      (await getSessionQuestions(sessionId)).flatMap((row) => {
        const q = questionFromRow(row)
        return q ? [{ ...q, position: row.position }] : []
      }),
    staleTime: Infinity,
    enabled: session.isSuccess,
  })
  const players = useQuery({
    queryKey: hostKeys.players(sessionId),
    queryFn: () => getSessionPlayers(sessionId),
    refetchInterval: disconnected ? 3000 : false,
    enabled: session.isSuccess,
  })
  const current: HostQuestion | undefined = session.data ? questions.data?.[session.data.current_index] : undefined
  const answers = useQuery({
    queryKey: hostKeys.answers(sessionId, current?.id),
    queryFn: () => getSessionAnswers(sessionId, current!.id),
    enabled: Boolean(current),
    refetchInterval: disconnected ? 3000 : false,
  })

  // Keep the latest rows reachable from realtime callbacks without resubscribing.
  const latest = useRef({ session: session.data, players: players.data })
  useEffect(() => {
    latest.current = { session: session.data, players: players.data }
  })

  // server - local clock offset, refreshed on every resync
  const clock = useQuery({
    queryKey: ['host', sessionId, 'clock'],
    queryFn: async () => {
      const { serverNow, startedAt, receivedAt } = await getServerTime()
      return estimateClockOffset(serverNow, startedAt, receivedAt)
    },
    staleTime: Infinity,
  })
  const clockOffset = clock.data ?? 0

  const resync = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['host', sessionId] })
  }, [qc, sessionId])

  useEffect(() => {
    if (!session.isSuccess) return
    const onEvent = (event: GameEvent) => {
      switch (event.type) {
        case 'player_joined':
        case 'player_left':
        case 'player_updated':
          qc.setQueryData<Player[]>(hostKeys.players(sessionId), (prev) => upsertPlayer(prev ?? [], event.player))
          break
        case 'answer_submitted':
          qc.setQueryData<PlayerAnswer[]>(hostKeys.answers(sessionId, event.answer.game_question_id), (prev) =>
            prev?.some((a) => a.id === event.answer.id) ? prev : [...(prev ?? []), event.answer],
          )
          break
        default:
          qc.setQueryData<GameSession>(hostKeys.session(sessionId), event.session)
      }
    }
    let wasConnected = false
    const unsubscribe = subscribeToGame({
      sessionId,
      role: 'host',
      getSession: () => latest.current.session,
      getPlayer: (id) => latest.current.players?.find((p) => p.id === id),
      onEvent,
      onStatus: (status) => {
        setConnection(status)
        // Events may have been missed while offline: rebuild from snapshots.
        if (status === 'connected' && wasConnected) resync()
        if (status === 'connected') wasConnected = true
      },
      onPresence: (metas) => setOnlinePlayerIds(new Set(metas.flatMap((m) => (m.role === 'player' && m.playerId ? [m.playerId] : [])))),
    })
    const onVisible = () => document.visibilityState === 'visible' && resync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', resync)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', resync)
    }
  }, [session.isSuccess, sessionId, qc, resync])

  const advance = useMutation({
    mutationFn: (from: GameSession['state']) => hostAdvance(sessionId, from),
    onSuccess: (s) => qc.setQueryData(hostKeys.session(sessionId), s),
  })
  const kick = useMutation({ mutationFn: (playerId: string) => kickPlayer(playerId) })
  const lock = useMutation({
    mutationFn: (locked: boolean) => setSessionLocked(sessionId, locked),
    onSuccess: (_d, locked) => qc.setQueryData<GameSession>(hostKeys.session(sessionId), (s) => (s ? { ...s, locked } : s)),
  })
  const end = useMutation({ mutationFn: () => hostEndGame(sessionId), onSuccess: resync })

  // Automatic pacing: the intro lasts a few seconds, and the question closes at the buzzer.
  const s = session.data
  const { mutate: advanceMutate } = advance
  useEffect(() => {
    if (!s) return
    let delay: number | null = null
    if (s.state === 'QUESTION_INTRO') delay = INTRO_DURATION_MS - elapsedMs(s.phase_started_at, clockOffset)
    if (s.state === 'QUESTION_ACTIVE') delay = remainingMs(s.question_deadline, clockOffset) + 250
    if (delay === null) return
    const state = s.state
    const timer = window.setTimeout(() => advanceMutate(state), Math.max(0, delay))
    return () => window.clearTimeout(timer)
  }, [s, clockOffset, advanceMutate])

  const activePlayers = useMemo(() => (players.data ?? []).filter((p) => p.status === 'active'), [players.data])

  return {
    session,
    questions,
    players,
    activePlayers,
    current,
    answers: answers.data ?? [],
    connection,
    onlinePlayerIds,
    clockOffset,
    advance,
    kick,
    lock,
    end,
  }
}
