import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  VITE_ENABLE_GOOGLE_AUTH: z.enum(['true', 'false']).optional(),
})

const parsed = schema.safeParse(import.meta.env)
const values = parsed.success ? parsed.data : {}

export const env = {
  supabaseUrl: values.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: values.VITE_SUPABASE_ANON_KEY ?? '',
  googleAuthEnabled: values.VITE_ENABLE_GOOGLE_AUTH === 'true',
}

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
