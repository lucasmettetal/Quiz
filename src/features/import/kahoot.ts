/**
 * Kahoot → Tilt conversion.
 *
 * The raw JSON comes from Kahoot's public (undocumented) endpoint, fetched by
 * the `import-kahoot` Edge Function. Its shape may change without notice, so
 * everything is parsed leniently and anything not understood becomes a
 * warning instead of a crash. This module is pure and unit-tested.
 */
import { z } from 'zod'
import { MAX_OPTIONS } from '@/features/questions/definitions'
import { newOptionId, type Question } from '@/features/questions/model'
import { nearestTimeLimit, parseBooleanWord, plainText, pointsFrom, type ImportDraft, type ImportWarning } from './model'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * Accepts the URLs people actually copy: create.kahoot.it/details/<id>,
 * create.kahoot.it/share/<slug>/<id>, play.kahoot.it/v2/?quizId=<id>, kahoot.it/challenge/…
 */
export function extractKahootId(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.hostname !== 'kahoot.it' && !url.hostname.endsWith('.kahoot.it')) return null
  const match = (url.searchParams.get('quizId') ?? '').match(UUID) ?? url.pathname.match(UUID)
  return match ? match[0].toLowerCase() : null
}

const choiceSchema = z.object({
  answer: z.string().optional().catch(undefined),
  correct: z.boolean().optional().catch(undefined),
  image: z.unknown().optional(),
})

const questionSchema = z.object({
  type: z.string().catch('quiz'),
  question: z.string().optional().catch(undefined),
  title: z.string().optional().catch(undefined),
  time: z.number().optional().catch(undefined),
  points: z.boolean().optional().catch(undefined),
  pointsMultiplier: z.number().optional().catch(undefined),
  choices: z.array(choiceSchema).optional().catch(undefined),
  image: z.string().optional().catch(undefined),
  imageMetadata: z.object({ altText: z.string().optional().catch(undefined) }).optional().catch(undefined),
  video: z.object({ id: z.string().optional().catch(undefined) }).optional().catch(undefined),
  layout: z.string().optional().catch(undefined),
})

export const kahootSchema = z.object({
  title: z.string().catch(''),
  description: z.string().optional().catch(undefined),
  cover: z.string().optional().catch(undefined),
  questions: z.array(z.unknown()).catch([]),
})
export type RawKahoot = z.infer<typeof kahootSchema>

function httpsUrl(value: string | undefined): string | null {
  return value && /^https:\/\//.test(value) ? value : null
}

export function convertKahoot(raw: unknown): ImportDraft {
  // Accept either the kahoot object or the `{ card, kahoot }` envelope.
  const body = raw && typeof raw === 'object' && 'kahoot' in raw ? (raw as { kahoot: unknown }).kahoot : raw
  const kahoot = kahootSchema.parse(body ?? {})
  const warnings: ImportWarning[] = []
  const questions: Question[] = []

  kahoot.questions.forEach((rawQuestion, index) => {
    const at = index + 1
    const parsed = questionSchema.safeParse(rawQuestion)
    if (!parsed.success) {
      warnings.push({ code: 'unsupported_type', at, detail: 'unknown' })
      return
    }
    const q = parsed.data
    const prompt = plainText(q.question ?? q.title, 500)
    const time_limit_s = nearestTimeLimit((q.time ?? 20000) / 1000)
    const points = q.points === false ? 0 : pointsFrom(q.pointsMultiplier === undefined ? 1000 : q.pointsMultiplier * 1000)
    const image = httpsUrl(q.image)
    const media = image ? { path: image, alt: plainText(q.imageMetadata?.altText, 200) } : null
    if (q.video?.id) warnings.push({ code: 'video_dropped', at })

    const allChoices = q.choices ?? []
    if (allChoices.some((c) => !plainText(c.answer, 120) && c.image)) warnings.push({ code: 'image_answers', at })
    if (allChoices.length > MAX_OPTIONS) warnings.push({ code: 'too_many_options', at })
    const choices = allChoices.slice(0, MAX_OPTIONS).map((c) => ({ text: plainText(c.answer, 120), correct: c.correct === true }))
    const base = { id: crypto.randomUUID(), prompt, media, time_limit_s }

    switch (q.type) {
      case 'quiz': {
        const tf = choices.length === 2 ? choices.map((c) => parseBooleanWord(c.text)) : null
        const isTrueFalse = q.layout === 'TRUE_FALSE' || (tf !== null && tf[0] !== null && tf[1] !== null && tf[0] !== tf[1])
        const correctChoice = choices.find((c) => c.correct)
        if (isTrueFalse && correctChoice) {
          const value = parseBooleanWord(correctChoice.text) ?? choices.indexOf(correctChoice) === 0
          questions.push({ ...base, type: 'true_false', points, content: { correct: value } })
        } else {
          questions.push({ ...base, type: 'quiz', points, content: { options: choices.map((c) => ({ id: newOptionId(), ...c })) } })
        }
        break
      }
      case 'open_ended': {
        // Kahoot's "type answer": accepted answers are the (correct) choices.
        const accepted = choices.filter((c) => c.text && c.correct !== false).map((c) => c.text)
        questions.push({ ...base, type: 'text', points, content: { accepted: accepted.length ? accepted : [''], caseSensitive: false } })
        break
      }
      case 'survey':
        questions.push({ ...base, type: 'poll', points: 0, content: { options: choices.map((c) => ({ id: newOptionId(), text: c.text })) } })
        break
      default:
        warnings.push({ code: 'unsupported_type', at, detail: q.type })
    }
  })

  return {
    source: 'kahoot',
    title: plainText(kahoot.title, 120),
    description: plainText(kahoot.description, 1000),
    coverImageUrl: httpsUrl(kahoot.cover),
    questions,
    warnings,
  }
}
