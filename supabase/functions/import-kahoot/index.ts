// Supabase Edge Function: import-kahoot
//
// Fetches a PUBLIC kahoot by URL and returns its raw content. This is the
// only place that knows about Kahoot's undocumented endpoint: if it changes or
// disappears, only this file needs updating, and the app falls back to the
// CSV/XLSX import. Conversion to Tilt's format happens client-side
// (src/features/import/kahoot.ts) where it is unit-tested.
//
// Safety: only signed-in creators may call it, only kahoot.it UUIDs are
// accepted (never an arbitrary URL → no open proxy / SSRF), responses are
// size-limited and trimmed to the fields we use.
//
// Deploy: supabase functions deploy import-kahoot

import { createClient } from 'npm:@supabase/supabase-js@2'

const KAHOOT_ENDPOINT = (id: string) => `https://create.kahoot.it/rest/kahoots/${id}/card/?includeKahoot=true`
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const MAX_BYTES = 2_000_000

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Same rules as extractKahootId() in the app. */
function kahootId(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.hostname !== 'kahoot.it' && !url.hostname.endsWith('.kahoot.it')) return null
  const match = (url.searchParams.get('quizId') ?? '').match(UUID) ?? url.pathname.match(UUID)
  return match ? match[0].toLowerCase() : null
}

type Json = Record<string, unknown>
const pick = (obj: Json, keys: string[]) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return reply(405, { code: 'INVALID_PAYLOAD' })

  // Signed-in, non-anonymous users only.
  const authorization = req.headers.get('Authorization')
  if (!authorization) return reply(401, { code: 'NOT_AUTHENTICATED' })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user || auth.user.is_anonymous) return reply(401, { code: 'NOT_AUTHENTICATED' })

  let body: Json
  try {
    body = await req.json()
  } catch {
    return reply(400, { code: 'INVALID_PAYLOAD' })
  }
  const id = kahootId(body.url)
  if (!id) return reply(400, { code: 'KAHOOT_URL_INVALID' })

  let res: Response
  try {
    res = await fetch(KAHOOT_ENDPOINT(id), {
      headers: { Accept: 'application/json', 'User-Agent': 'Tilt quiz importer' },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    return reply(502, { code: 'KAHOOT_UNAVAILABLE' })
  }
  if (res.status === 404) return reply(404, { code: 'KAHOOT_NOT_FOUND' })
  if (res.status === 401 || res.status === 403) return reply(403, { code: 'KAHOOT_PRIVATE' })
  if (!res.ok) return reply(502, { code: 'KAHOOT_UNAVAILABLE' })

  const text = await res.text()
  if (text.length > MAX_BYTES) return reply(502, { code: 'KAHOOT_UNAVAILABLE' })
  let json: Json
  try {
    json = JSON.parse(text)
  } catch {
    return reply(502, { code: 'KAHOOT_UNAVAILABLE' })
  }
  const kahoot = (json.kahoot ?? json) as Json
  if (!kahoot || !Array.isArray(kahoot.questions)) return reply(502, { code: 'KAHOOT_UNAVAILABLE' })

  const questions = (kahoot.questions as Json[]).slice(0, 100).map((q) =>
    pick(q, ['type', 'question', 'title', 'time', 'points', 'pointsMultiplier', 'choices', 'image', 'imageMetadata', 'video', 'layout']),
  )
  return reply(200, { kahoot: { ...pick(kahoot, ['title', 'description', 'cover', 'language']), questions } })
})
