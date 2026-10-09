/**
 * Realtime layer of a live game.
 *
 * Database changes (already filtered by RLS) are turned into domain events
 * (features/game/engine/events.ts). Presence tells who is *connected* right
 * now — a temporary disconnection is not the same as leaving the game.
 *
 * Realtime is only a notification channel: every screen can rebuild itself
 * from a snapshot, so on (re)connection callers refetch.
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { gameSessionSchema, playerAnswerSchema, playerSchema, type GameSession, type Player } from '@/types/database'
import { playerEvent, sessionEvent, type GameEvent } from '@/features/game/engine/events'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface PresenceMeta {
  role: 'host' | 'player'
  playerId?: string
}

interface SubscribeOptions {
  sessionId: string
  /** Host listens to every player and answer; a player only to itself. */
  role: 'host' | 'player'
  playerId?: string
  /** Last known rows, used to derive transition events. */
  getSession: () => GameSession | null | undefined
  getPlayer: (id: string) => Player | null | undefined
  onEvent: (event: GameEvent) => void
  onStatus: (status: ConnectionStatus) => void
  onPresence?: (online: PresenceMeta[]) => void
}

export function subscribeToGame(opts: SubscribeOptions): () => void {
  const supabase = getSupabase()
  const { sessionId, role, playerId } = opts
  const channel: RealtimeChannel = supabase.channel(`game:${sessionId}`, {
    config: { presence: { key: role === 'host' ? 'host' : (playerId ?? 'anon') } },
  })

  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_sessions', filter: `id=eq.${sessionId}` }, (payload) => {
    const parsed = gameSessionSchema.safeParse(payload.new)
    if (parsed.success) opts.onEvent(sessionEvent(opts.getSession(), parsed.data))
  })

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'players',
      filter: role === 'host' ? `session_id=eq.${sessionId}` : `id=eq.${playerId}`,
    },
    (payload) => {
      const parsed = playerSchema.safeParse(payload.new)
      if (parsed.success) opts.onEvent(playerEvent(opts.getPlayer(parsed.data.id), parsed.data))
    },
  )

  if (role === 'host') {
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_answers', filter: `session_id=eq.${sessionId}` }, (payload) => {
      const parsed = playerAnswerSchema.safeParse(payload.new)
      if (parsed.success) opts.onEvent({ type: 'answer_submitted', answer: parsed.data })
    })
  }

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<PresenceMeta>()
    opts.onPresence?.(Object.values(state).flatMap((metas) => metas.map(({ role: r, playerId: p }) => ({ role: r, playerId: p }))))
  })

  opts.onStatus('connecting')
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      opts.onStatus('connected')
      void channel.track({ role, playerId } satisfies PresenceMeta)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      opts.onStatus('disconnected')
    }
  })

  return () => {
    void channel.untrack()
    void supabase.removeChannel(channel)
  }
}
