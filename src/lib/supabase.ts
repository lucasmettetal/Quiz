import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, isSupabaseConfigured } from './env'
import { AppError } from './errors'

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null

/** The Supabase client. Throws a CONFIG_MISSING AppError when env vars are absent. */
export function getSupabase(): SupabaseClient {
  if (!client) throw new AppError('CONFIG_MISSING')
  return client
}

export const MEDIA_BUCKET = 'quiz-media'

export function mediaPublicUrl(path: string | null | undefined): string | null {
  if (!path || !client) return null
  return client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}
