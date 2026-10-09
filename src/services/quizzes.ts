import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { toAppError, unwrap } from '@/lib/errors'
import { PALETTE } from '@/lib/palette'
import { questionRowSchema, quizSchema, type Quiz, type QuizCategory, type Visibility } from '@/types/database'

const authorSchema = z.object({ display_name: z.string(), avatar_color: z.enum(PALETTE), avatar_config: z.unknown().optional() }).nullable()

export const quizWithMetaSchema = quizSchema.extend({
  author: authorSchema.optional(),
  quiz_tags: z.array(z.object({ tag: z.string() })).optional(),
})
export type QuizWithMeta = z.infer<typeof quizWithMetaSchema>

const SELECT_WITH_META = '*, author:profiles!quizzes_owner_id_fkey(display_name, avatar_color, avatar_config), quiz_tags(tag)'

export type QuizSort = 'updated' | 'created' | 'title' | 'plays'
export type QuizStatusFilter = 'all' | 'draft' | 'published'

const SORT_COLUMNS: Record<QuizSort, { column: string; ascending: boolean }> = {
  updated: { column: 'updated_at', ascending: false },
  created: { column: 'created_at', ascending: false },
  title: { column: 'title', ascending: true },
  plays: { column: 'play_count', ascending: false },
}

/** Escapes `%`, `_` and `,` for PostgREST ilike filters. */
function likePattern(search: string) {
  return `%${search.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()]/g, ' ')}%`
}

export async function listMyQuizzes(
  ownerId: string,
  opts: { search?: string; status?: QuizStatusFilter; sort?: QuizSort; limit?: number } = {},
): Promise<QuizWithMeta[]> {
  const { column, ascending } = SORT_COLUMNS[opts.sort ?? 'updated']
  let query = getSupabase().from('quizzes').select(SELECT_WITH_META).eq('owner_id', ownerId)
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status)
  if (opts.search?.trim()) query = query.ilike('title', likePattern(opts.search.trim()))
  query = query.order(column, { ascending })
  if (opts.limit) query = query.limit(opts.limit)
  return z.array(quizWithMetaSchema).parse(unwrap(await query))
}

export interface ExploreFilters {
  search?: string
  category?: QuizCategory | 'all'
  language?: string | 'all'
  sort?: 'recent' | 'popular'
  page?: number
}

export const EXPLORE_PAGE_SIZE = 24

export async function listPublicQuizzes(filters: ExploreFilters = {}): Promise<{ items: QuizWithMeta[]; hasMore: boolean }> {
  const page = filters.page ?? 0
  let query = getSupabase()
    .from('quizzes')
    .select(SELECT_WITH_META)
    .eq('visibility', 'public')
    .eq('status', 'published')
  if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category)
  if (filters.language && filters.language !== 'all') query = query.eq('language', filters.language)
  if (filters.search?.trim()) query = query.ilike('title', likePattern(filters.search.trim()))
  query =
    filters.sort === 'popular'
      ? query.order('play_count', { ascending: false }).order('published_at', { ascending: false })
      : query.order('published_at', { ascending: false })
  query = query.range(page * EXPLORE_PAGE_SIZE, page * EXPLORE_PAGE_SIZE + EXPLORE_PAGE_SIZE) // one extra row = hasMore
  const rows = z.array(quizWithMetaSchema).parse(unwrap(await query))
  return { items: rows.slice(0, EXPLORE_PAGE_SIZE), hasMore: rows.length > EXPLORE_PAGE_SIZE }
}

export async function getQuiz(id: string): Promise<QuizWithMeta> {
  const { data, error } = await getSupabase().from('quizzes').select(SELECT_WITH_META).eq('id', id).maybeSingle()
  if (error) throw toAppError(error)
  if (!data) throw toAppError(new Error('QUIZ_NOT_FOUND'))
  return quizWithMetaSchema.parse(data)
}

export async function getQuizQuestions(quizId: string) {
  const rows = unwrap(await getSupabase().from('questions').select('*').eq('quiz_id', quizId).order('position'))
  return z.array(questionRowSchema).parse(rows)
}

export async function createQuiz(input: { title?: string } = {}): Promise<Quiz> {
  const { data, error } = await getSupabase()
    .from('quizzes')
    .insert({ title: input.title ?? '' })
    .select('*')
    .single()
  if (error) throw toAppError(error)
  return quizSchema.parse(data)
}

export async function deleteQuiz(id: string) {
  const { error } = await getSupabase().from('quizzes').delete().eq('id', id)
  if (error) throw toAppError(error)
}

export async function duplicateQuiz(id: string, title: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('duplicate_quiz', { p_quiz_id: id, p_title: title })
  if (error) throw toAppError(error)
  return z.string().parse(data)
}

export async function publishQuiz(id: string, visibility: Visibility): Promise<Quiz> {
  const { data, error } = await getSupabase().rpc('publish_quiz', { p_quiz_id: id, p_visibility: visibility })
  if (error) throw toAppError(error)
  return quizSchema.parse(data)
}

/* ------------------------------------------------------------------ favorites */

export async function listFavoriteIds(): Promise<Set<string>> {
  const rows = unwrap(await getSupabase().from('favorites').select('quiz_id'))
  return new Set(z.array(z.object({ quiz_id: z.string() })).parse(rows).map((r) => r.quiz_id))
}

export async function listFavoriteQuizzes(): Promise<QuizWithMeta[]> {
  const rows = unwrap(
    await getSupabase()
      .from('favorites')
      .select(`created_at, quiz:quizzes(${SELECT_WITH_META})`)
      .order('created_at', { ascending: false }),
  )
  return z
    .array(z.object({ quiz: quizWithMetaSchema.nullable() }))
    .parse(rows)
    .flatMap((r) => (r.quiz ? [r.quiz] : []))
}

export async function setFavorite(quizId: string, favorite: boolean) {
  const supabase = getSupabase()
  const { error } = favorite
    ? await supabase.from('favorites').insert({ quiz_id: quizId })
    : await supabase.from('favorites').delete().eq('quiz_id', quizId)
  // Inserting an existing favorite is not an error for the user.
  if (error && error.code !== '23505') throw toAppError(error)
}
