/**
 * Importing quizzes from outside Tilt.
 *
 * Sources are isolated behind small functions so a fragile one (Kahoot's
 * undocumented endpoint, reached through the `import-kahoot` Edge Function)
 * can break without affecting the others (CSV/XLSX files).
 */
import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import { AppError, toAppError } from '@/lib/errors'
import { convertKahoot } from '@/features/import/kahoot'
import { parseCsv, tableToDraft } from '@/features/import/table'
import type { ImportDraft } from '@/features/import/model'
import type { Question } from '@/features/questions/model'
import { createQuiz } from './quizzes'
import { saveQuiz } from './editor'
import { uploadQuizImage } from './storage'

const MAX_FILE_BYTES = 5 * 1024 * 1024

export async function fetchKahootDraft(url: string): Promise<ImportDraft> {
  const { data, error } = await getSupabase().functions.invoke('import-kahoot', { body: { url } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { code?: string } | null
      throw toAppError(new Error(body?.code ?? 'KAHOOT_UNAVAILABLE'))
    }
    // Function not deployed / network failure.
    throw new AppError('KAHOOT_UNAVAILABLE', error)
  }
  const draft = convertKahoot(data)
  if (draft.questions.length === 0) throw new AppError('IMPORT_EMPTY')
  return draft
}

export async function readFileDraft(file: File): Promise<ImportDraft> {
  if (file.size > MAX_FILE_BYTES) throw new AppError('IMPORT_FILE_INVALID')
  let rows: string[][]
  try {
    if (/\.xlsx$/i.test(file.name)) {
      // Loaded on demand: most users never import a spreadsheet.
      const { readXlsx } = await import('@/features/import/xlsx')
      rows = readXlsx(await file.arrayBuffer())
    } else {
      rows = parseCsv(await file.text())
    }
  } catch (e) {
    throw toAppError(e instanceof Error && e.message === 'IMPORT_FILE_INVALID' ? e : new Error('IMPORT_FILE_INVALID'))
  }
  let draft: ImportDraft
  try {
    draft = tableToDraft(rows, file.name)
  } catch {
    throw new AppError('IMPORT_FILE_INVALID')
  }
  if (draft.questions.length === 0) throw new AppError('IMPORT_EMPTY')
  return draft
}

/** Copies an external image into our bucket when the browser may read it; otherwise keeps the URL. */
async function rehost(url: string, userId: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return url
    const blob = await res.blob()
    const name = url.split('/').pop()?.split('?')[0] || 'image'
    return await uploadQuizImage(new File([blob], name, { type: blob.type }), userId)
  } catch {
    return url
  }
}

/** Creates the quiz in the user's library and returns its id. */
export async function importDraft(draft: ImportDraft, userId: string, onProgress?: (done: number, total: number) => void) {
  const images = draft.questions.filter((q) => q.media?.path.startsWith('https://')).length + (draft.coverImageUrl ? 1 : 0)
  let done = 0
  const step = () => onProgress?.(++done, images)

  const questions: Question[] = []
  for (const q of draft.questions) {
    if (q.media && q.media.path.startsWith('https://')) {
      questions.push({ ...q, media: { ...q.media, path: await rehost(q.media.path, userId) } })
      step()
    } else questions.push(q)
  }
  const cover = draft.coverImageUrl ? await rehost(draft.coverImageUrl, userId) : null
  if (draft.coverImageUrl) step()

  const quiz = await createQuiz({ title: draft.title })
  await saveQuiz(
    quiz.id,
    quiz.version,
    {
      title: draft.title,
      description: draft.description,
      language: quiz.language,
      category: quiz.category,
      cover_color: quiz.cover_color,
      cover_pattern: quiz.cover_pattern,
      cover_image_path: cover,
      tags: [],
    },
    questions,
  )
  return quiz.id
}
