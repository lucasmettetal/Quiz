import { create } from 'zustand'
import { arrayMove } from '@dnd-kit/sortable'
import type { Question, QuestionType } from '@/features/questions/model'
import { convertQuestion, createQuestion, duplicateQuestion } from '@/features/questions/registry'
import type { SaveStatus } from '@/features/editor/autosave'
import type { AppError } from '@/lib/errors'
import type { PaletteColor, PatternName } from '@/lib/palette'
import type { QuizCategory, Visibility } from '@/types/database'

export interface EditorMeta {
  title: string
  description: string
  language: string
  category: QuizCategory
  cover_color: PaletteColor
  cover_pattern: PatternName
  cover_image_path: string | null
  tags: string[]
}

export interface EditorSnapshot {
  quizId: string
  version: number
  meta: EditorMeta
  questions: Question[]
}

interface EditorState extends EditorSnapshot {
  status: 'draft' | 'published'
  visibility: Visibility
  selectedId: string | null
  /** Incremented on every user change; drives autosave. */
  revision: number
  saveStatus: SaveStatus
  saveError: AppError | null
  /** Quiz currently loaded in the store (null until load). */
  loadedQuizId: string | null
  /** The loaded state came from an unsaved local draft. */
  restoredDraft: boolean

  reset: () => void
  load: (snapshot: EditorSnapshot & { status: 'draft' | 'published'; visibility: Visibility }, opts?: { dirty?: boolean }) => void
  setMeta: (patch: Partial<EditorMeta>) => void
  select: (id: string) => void
  addQuestion: (type: QuestionType) => void
  updateQuestion: (question: Question) => void
  changeType: (id: string, type: QuestionType) => void
  duplicate: (id: string) => void
  remove: (id: string) => { question: Question; index: number } | null
  restore: (question: Question, index: number) => void
  move: (fromId: string, toId: string) => void
  setVersion: (version: number) => void
  setSaveStatus: (status: SaveStatus, error?: AppError | null) => void
  setPublication: (status: 'draft' | 'published', visibility: Visibility) => void
}

const touched = (s: EditorState) => ({ revision: s.revision + 1 })

export const useEditorStore = create<EditorState>((set, get) => ({
  quizId: '',
  version: 0,
  meta: {
    title: '',
    description: '',
    language: 'fr',
    category: 'general',
    cover_color: 'vermilion',
    cover_pattern: 'stripes',
    cover_image_path: null,
    tags: [],
  },
  questions: [],
  status: 'draft',
  visibility: 'private',
  selectedId: null,
  revision: 0,
  saveStatus: 'idle',
  saveError: null,
  loadedQuizId: null,
  restoredDraft: false,

  reset: () => set({ loadedQuizId: null, restoredDraft: false, questions: [], selectedId: null, revision: 0, saveStatus: 'idle', saveError: null }),

  load: (snapshot, opts) =>
    set({
      loadedQuizId: snapshot.quizId,
      restoredDraft: Boolean(opts?.dirty),
      ...snapshot,
      selectedId: snapshot.questions[0]?.id ?? null,
      revision: opts?.dirty ? 1 : 0,
      saveStatus: opts?.dirty ? 'pending' : 'idle',
      saveError: null,
    }),

  setMeta: (patch) => set((s) => ({ meta: { ...s.meta, ...patch }, ...touched(s) })),

  select: (id) => set({ selectedId: id }),

  addQuestion: (type) =>
    set((s) => {
      const q = createQuestion(type)
      const at = s.selectedId ? s.questions.findIndex((x) => x.id === s.selectedId) + 1 : s.questions.length
      const questions = [...s.questions]
      questions.splice(at, 0, q)
      return { questions, selectedId: q.id, ...touched(s) }
    }),

  updateQuestion: (question) =>
    set((s) => ({ questions: s.questions.map((q) => (q.id === question.id ? question : q)), ...touched(s) })),

  changeType: (id, type) =>
    set((s) => ({ questions: s.questions.map((q) => (q.id === id ? convertQuestion(q, type) : q)), ...touched(s) })),

  duplicate: (id) =>
    set((s) => {
      const index = s.questions.findIndex((q) => q.id === id)
      if (index < 0) return s
      const copy = duplicateQuestion(s.questions[index]!)
      const questions = [...s.questions]
      questions.splice(index + 1, 0, copy)
      return { questions, selectedId: copy.id, ...touched(s) }
    }),

  remove: (id) => {
    const s = get()
    const index = s.questions.findIndex((q) => q.id === id)
    if (index < 0) return null
    const question = s.questions[index]!
    const questions = s.questions.filter((q) => q.id !== id)
    const nextSelected = s.selectedId === id ? (questions[Math.min(index, questions.length - 1)]?.id ?? null) : s.selectedId
    set({ questions, selectedId: nextSelected, ...touched(s) })
    return { question, index }
  },

  restore: (question, index) =>
    set((s) => {
      if (s.questions.some((q) => q.id === question.id)) return s
      const questions = [...s.questions]
      questions.splice(Math.min(index, questions.length), 0, question)
      return { questions, selectedId: question.id, ...touched(s) }
    }),

  move: (fromId, toId) =>
    set((s) => {
      const from = s.questions.findIndex((q) => q.id === fromId)
      const to = s.questions.findIndex((q) => q.id === toId)
      if (from < 0 || to < 0 || from === to) return s
      return { questions: arrayMove(s.questions, from, to), ...touched(s) }
    }),

  setVersion: (version) => set({ version }),
  setSaveStatus: (saveStatus, saveError = null) => set({ saveStatus, saveError }),
  setPublication: (status, visibility) => set({ status, visibility }),
}))

export function snapshotOf(s: EditorSnapshot): EditorSnapshot {
  return { quizId: s.quizId, version: s.version, meta: s.meta, questions: s.questions }
}
