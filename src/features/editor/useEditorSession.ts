import { useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { loadQuizForEditing, saveQuiz } from '@/services/editor'
import { getQuiz, type QuizWithMeta } from '@/services/quizzes'
import { useEditorStore, type EditorMeta, type EditorSnapshot } from '@/stores/editorStore'
import { safeStorage } from '@/lib/storage'
import { quizKeys } from '@/features/quizzes/useQuizActions'
import { Autosaver } from './autosave'

const draftKey = (quizId: string) => `tilt.draft.${quizId}`

/** Local backup of unsaved work: survives a crash, a closed tab or a long offline period. */
function writeDraft(s: EditorSnapshot) {
  safeStorage.set(draftKey(s.quizId), JSON.stringify({ version: s.version, meta: s.meta, questions: s.questions }))
}

function readDraft(quizId: string): Pick<EditorSnapshot, 'version' | 'meta' | 'questions'> | null {
  const raw = safeStorage.get(draftKey(quizId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Pick<EditorSnapshot, 'version' | 'meta' | 'questions'>
    return typeof parsed.version === 'number' && Array.isArray(parsed.questions) ? parsed : null
  } catch {
    return null
  }
}

const clearDraft = (quizId: string) => safeStorage.remove(draftKey(quizId))

export function metaFromQuiz(quiz: QuizWithMeta): EditorMeta {
  return {
    title: quiz.title,
    description: quiz.description,
    language: quiz.language,
    category: quiz.category,
    cover_color: quiz.cover_color,
    cover_pattern: quiz.cover_pattern,
    cover_image_path: quiz.cover_image_path,
    tags: quiz.quiz_tags?.map((t) => t.tag) ?? [],
  }
}

export function useEditorSession(quizId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['editor', quizId],
    queryFn: () => loadQuizForEditing(quizId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  })
  const ready = useEditorStore((s) => s.loadedQuizId === quizId)
  const restoredDraft = useEditorStore((s) => s.loadedQuizId === quizId && s.restoredDraft)
  const saverRef = useRef<Autosaver | null>(null)
  const load = useEditorStore((s) => s.load)
  const reset = useEditorStore((s) => s.reset)

  // 1. Initialize the store from the server, or from a newer local draft.
  useEffect(() => {
    if (!query.data) return
    const { quiz, questions } = query.data
    const server = {
      quizId,
      version: quiz.version,
      meta: metaFromQuiz(quiz),
      questions,
      status: quiz.status,
      visibility: quiz.visibility,
    }
    const draft = readDraft(quizId)
    const differs = draft && JSON.stringify([draft.meta, draft.questions]) !== JSON.stringify([server.meta, server.questions])
    if (draft && draft.version === quiz.version && differs) {
      load({ ...server, meta: { ...server.meta, ...draft.meta }, questions: draft.questions }, { dirty: true })
    } else {
      clearDraft(quizId)
      load(server)
    }
    return reset
  }, [query.data, quizId, load, reset])

  // 2. Autosave every change.
  useEffect(() => {
    if (!ready) return
    const saver = new Autosaver({
      save: async () => {
        const s = useEditorStore.getState()
        const version = await saveQuiz(s.quizId, s.version, s.meta, s.questions)
        useEditorStore.getState().setVersion(version)
      },
      onStatus: (status, error) => {
        useEditorStore.getState().setSaveStatus(status, error ?? null)
        if (status === 'saved') {
          clearDraft(quizId)
          void queryClient.invalidateQueries({ queryKey: quizKeys.all })
        }
      },
    })
    saverRef.current = saver
    let lastRevision = useEditorStore.getState().revision
    if (lastRevision > 0) saver.schedule()
    const unsubscribe = useEditorStore.subscribe((s) => {
      if (s.revision === lastRevision) return
      lastRevision = s.revision
      writeDraft(s)
      saver.schedule()
    })
    const onOnline = () => saver.online()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.hasPendingChanges) e.preventDefault()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      unsubscribe()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('beforeunload', onBeforeUnload)
      void saver.flush().finally(() => saver.dispose())
      saverRef.current = null
    }
  }, [ready, quizId, queryClient])

  /** Save now (before launching / leaving). Resolves once the server has everything. */
  const flush = useCallback(async () => {
    await saverRef.current?.flush()
    return !saverRef.current?.hasPendingChanges
  }, [])

  /** Conflict: drop local changes and load the server version. */
  const reloadFromServer = useCallback(() => {
    clearDraft(quizId)
    window.location.reload()
  }, [quizId])

  /** Conflict: keep local changes and write them over the newer server version. */
  const overwriteServer = useCallback(async () => {
    const quiz = await getQuiz(quizId)
    useEditorStore.getState().setVersion(quiz.version)
    saverRef.current?.resume()
  }, [quizId])

  return { query, ready, restoredDraft, flush, reloadFromServer, overwriteServer }
}
