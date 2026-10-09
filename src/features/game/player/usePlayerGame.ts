import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AnyAnswer } from '@/features/questions/model'
import { getPlayerView, leaveSession, submitAnswer, type PlayerView } from '@/services/play'
import { subscribeToGame, type ConnectionStatus } from '@/services/realtime'
import { AppError, toAppError } from '@/lib/errors'

const HOST_AWAY_GRACE_MS = 5000

export const playKey = (sessionId: string) => ['play', sessionId] as const

/**
 * The player's screen is a pure function of `get_player_view`. Realtime only
 * says "something changed": we refetch (coalesced), which makes refreshes,
 * reconnections and late joins all behave the same way.
 */
export function usePlayerGame(sessionId: string) {
  const qc = useQueryClient()
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [hostAway, setHostAway] = useState(false)
  const [pending, setPending] = useState<{ questionId: string; answer: AnyAnswer } | null>(null)
  const [submitError, setSubmitError] = useState<AppError | null>(null)

  const view = useQuery({
    queryKey: playKey(sessionId),
    queryFn: () => getPlayerView(sessionId),
    // Safety net in case an event is missed; much faster while realtime is down.
    refetchInterval: connection === 'disconnected' ? 3000 : 15000,
    retry: (count, error) => count < 3 && toAppError(error).code === 'NETWORK',
  })
  const playerId = view.data?.player.id

  const refetchSoon = useRef<number | null>(null)
  const scheduleRefetch = useCallback(() => {
    if (refetchSoon.current) window.clearTimeout(refetchSoon.current)
    refetchSoon.current = window.setTimeout(() => void qc.invalidateQueries({ queryKey: playKey(sessionId) }), 120)
  }, [qc, sessionId])

  useEffect(() => {
    if (!playerId) return
    let hostTimer: number | null = null
    let wasConnected = false
    const unsubscribe = subscribeToGame({
      sessionId,
      role: 'player',
      playerId,
      getSession: () => null,
      getPlayer: () => null,
      onEvent: scheduleRefetch,
      onStatus: (status) => {
        setConnection(status)
        if (status === 'connected' && wasConnected) scheduleRefetch()
        if (status === 'connected') wasConnected = true
      },
      onPresence: (metas) => {
        const hostHere = metas.some((m) => m.role === 'host')
        if (hostTimer) window.clearTimeout(hostTimer)
        if (hostHere) setHostAway(false)
        else hostTimer = window.setTimeout(() => setHostAway(true), HOST_AWAY_GRACE_MS)
      },
    })
    const onVisible = () => document.visibilityState === 'visible' && scheduleRefetch()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', scheduleRefetch)
    return () => {
      unsubscribe()
      if (hostTimer) window.clearTimeout(hostTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', scheduleRefetch)
    }
  }, [playerId, sessionId, scheduleRefetch])

  const submit = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: string; answer: AnyAnswer }) => {
      try {
        await submitAnswer(sessionId, questionId, answer)
      } catch (e) {
        // A retry after a lost response: the first attempt went through.
        if (toAppError(e).code !== 'ALREADY_ANSWERED') throw e
      }
    },
    onMutate: ({ questionId, answer }) => {
      setSubmitError(null)
      setPending({ questionId, answer })
    },
    onError: (e) => {
      const error = toAppError(e)
      setSubmitError(error)
      // Network hiccup: let the player try again. Closed/time up: keep the lock.
      if (error.code === 'NETWORK' || error.code === 'INVALID_ANSWER') setPending(null)
    },
    onSettled: scheduleRefetch,
    retry: (count, e) => count < 2 && toAppError(e).code === 'NETWORK',
  })

  const leave = useMutation({ mutationFn: () => leaveSession(sessionId) })

  const data: PlayerView | undefined = view.data
  const currentQuestionId = data?.question?.id
  const submitted: AnyAnswer | null =
    (data?.answer?.answer as AnyAnswer | undefined) ?? (pending && pending.questionId === currentQuestionId ? pending.answer : null)

  return {
    view,
    connection,
    hostAway: hostAway && connection === 'connected',
    submitted,
    submitError: submitError && pending?.questionId === currentQuestionId ? submitError : submitError?.code === 'NETWORK' ? submitError : null,
    submitting: submit.isPending,
    answer: (questionId: string, answer: AnyAnswer) => submit.mutate({ questionId, answer }),
    leave,
  }
}
