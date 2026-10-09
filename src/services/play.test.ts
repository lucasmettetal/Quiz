import { describe, expect, it, vi } from 'vitest'

const single = vi.fn()
const rpc = vi.fn(() => ({ single }))
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc }) }))

const { joinSession } = await import('./play')
const { generateAvatarFromSeed, serializeAvatar } = await import('@/features/avatars/avatar')

describe('joinSession', () => {
  it('sends the avatar config and its main color (legacy accent column)', async () => {
    const avatar = generateAvatarFromSeed('Zoé')
    single.mockResolvedValue({
      data: {
        id: 'p1', session_id: 's1', user_id: 'u1', nickname: 'Zoé', avatar: avatar.primary, avatar_config: serializeAvatar(avatar),
        status: 'active', score: 0, last_points: 0, rank: null, previous_rank: null, streak: 0, correct_count: 0, joined_at: '2026-01-01',
      },
      error: null,
    })
    const player = await joinSession('123456', 'Zoé', avatar)
    expect(rpc).toHaveBeenCalledWith('join_session', {
      p_pin: '123456',
      p_nickname: 'Zoé',
      p_avatar: avatar.primary,
      p_avatar_config: serializeAvatar(avatar),
    })
    expect(player.avatar_config).toEqual(serializeAvatar(avatar))
  })
})
