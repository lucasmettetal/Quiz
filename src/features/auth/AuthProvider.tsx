import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isSupabaseConfigured } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'
import { fetchProfile } from '@/services/auth'
import type { Profile } from '@/types/database'

interface AuthContextValue {
  /** True until the stored session has been read. */
  initializing: boolean
  session: Session | null
  userId: string | null
  isAnonymous: boolean
  /** Registered creator profile (null for anonymous players / signed out). */
  profile: Profile | null
  profileLoading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export const profileQueryKey = (userId: string | null) => ['profile', userId] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(isSupabaseConfigured)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setInitializing(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id ?? null
  const isAnonymous = Boolean(session?.user.is_anonymous)

  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId) && !isAnonymous,
    staleTime: 5 * 60_000,
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      session,
      userId,
      isAnonymous,
      profile: profileQuery.data ?? null,
      profileLoading: Boolean(userId) && !isAnonymous && profileQuery.isPending,
    }),
    [initializing, session, userId, isAnonymous, profileQuery.data, profileQuery.isPending],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
