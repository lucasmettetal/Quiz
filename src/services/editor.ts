import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { toAppError } from '@/lib/errors'
import { questionFromRow, questionToPayload } from '@/features/questions/registry'
import type { Question } from '@/features/questions/model'
import type { EditorMeta } from '@/stores/editorStore'
import { getQuiz, getQuizQuestions } from './quizzes'

export async function loadQuizForEditing(quizId: string) {
  const quiz = await getQuiz(quizId)
  const rows = await getQuizQuestions(quizId)
  const questions = rows.map(questionFromRow).filter((q): q is Question => q !== null)
  return { quiz, questions }
}

/** Persists the whole quiz atomically. Returns the new version. */
export async function saveQuiz(quizId: string, expectedVersion: number, meta: EditorMeta, questions: Question[]) {
  const { data, error } = await getSupabase().rpc('save_quiz', {
    p_quiz_id: quizId,
    p_expected_version: expectedVersion,
    p_quiz: meta,
    p_questions: questions.map(questionToPayload),
  })
  if (error) throw toAppError(error)
  return z.number().parse(data)
}
