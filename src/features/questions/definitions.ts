import { z } from 'zod'
import { newOptionId, type ChoiceOption, type Question, type QuestionTypeDefinition } from './model'

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 6

/** Same normalization as SQL `public.normalize_text_answer`. */
export function normalizeTextAnswer(value: string, caseSensitive = false) {
  const collapsed = value.trim().replace(/\s+/g, ' ')
  return caseSensitive ? collapsed : collapsed.toLowerCase()
}

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().catch(''),
  correct: z.boolean().catch(false),
})

/** Option texts reusable from any choice-like question. */
function optionTextsOf(q: Question): string[] {
  if (q.type === 'quiz' || q.type === 'poll') return q.content.options.map((o) => o.text)
  return []
}

function choiceIssues(options: Array<{ text: string }>) {
  const issues: Array<'options_count' | 'option_empty'> = []
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) issues.push('options_count')
  if (options.some((o) => !o.text.trim())) issues.push('option_empty')
  return issues
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sa = new Set(a)
  return sa.size === a.length && b.every((x) => sa.has(x))
}

export const quizDefinition: QuestionTypeDefinition<'quiz'> = {
  type: 'quiz',
  category: 'test',
  graded: true,
  defaults: { time_limit_s: 20, points: 1000 },
  contentSchema: z.object({ options: z.array(optionSchema).catch([]) }),
  answerSchema: z.object({ optionIds: z.array(z.string()).min(1) }),
  createContent: () => ({
    options: Array.from({ length: 4 }, (_, i): ChoiceOption => ({ id: newOptionId(), text: '', correct: i === 0 })),
  }),
  validate(content) {
    const issues: ReturnType<QuestionTypeDefinition<'quiz'>['validate']> = choiceIssues(content.options)
    if (!content.options.some((o) => o.correct)) issues.push('no_correct')
    return issues
  },
  evaluate: (content, answer) =>
    sameSet(
      answer.optionIds,
      content.options.filter((o) => o.correct).map((o) => o.id),
    ),
  convertFrom(q) {
    if (q.type === 'quiz') return q.content
    if (q.type === 'true_false') {
      return {
        options: [
          { id: newOptionId(), text: '', correct: q.content.correct },
          { id: newOptionId(), text: '', correct: !q.content.correct },
        ],
      }
    }
    if (q.type === 'text') {
      const accepted = q.content.accepted.filter((a) => a.trim())
      const base = quizDefinition.createContent()
      if (accepted[0]) base.options[0]!.text = accepted[0]
      return base
    }
    const texts = optionTextsOf(q)
    return { options: texts.map((text, i) => ({ id: newOptionId(), text, correct: i === 0 })) }
  },
}

export const trueFalseDefinition: QuestionTypeDefinition<'true_false'> = {
  type: 'true_false',
  category: 'test',
  graded: true,
  defaults: { time_limit_s: 15, points: 1000 },
  contentSchema: z.object({ correct: z.boolean().catch(true) }),
  answerSchema: z.object({ value: z.boolean() }),
  createContent: () => ({ correct: true }),
  validate: () => [],
  evaluate: (content, answer) => content.correct === answer.value,
  convertFrom: (q) => (q.type === 'true_false' ? q.content : { correct: true }),
}

export const textDefinition: QuestionTypeDefinition<'text'> = {
  type: 'text',
  category: 'test',
  graded: true,
  defaults: { time_limit_s: 30, points: 1000 },
  contentSchema: z.object({
    accepted: z.array(z.string()).catch([]),
    caseSensitive: z.boolean().catch(false),
  }),
  answerSchema: z.object({ text: z.string().min(1).max(200) }),
  createContent: () => ({ accepted: [''], caseSensitive: false }),
  validate: (content) => (content.accepted.some((a) => a.trim()) ? [] : ['accepted_empty']),
  evaluate(content, answer) {
    const given = normalizeTextAnswer(answer.text, content.caseSensitive)
    return content.accepted.some((a) => a.trim() && normalizeTextAnswer(a, content.caseSensitive) === given)
  },
  convertFrom(q) {
    if (q.type === 'text') return q.content
    if (q.type === 'quiz') {
      const accepted = q.content.options.filter((o) => o.correct && o.text.trim()).map((o) => o.text)
      return { accepted: accepted.length ? accepted : [''], caseSensitive: false }
    }
    return textDefinition.createContent()
  },
}

export const pollDefinition: QuestionTypeDefinition<'poll'> = {
  type: 'poll',
  category: 'collect',
  graded: false,
  defaults: { time_limit_s: 20, points: 0 },
  contentSchema: z.object({
    options: z.array(z.object({ id: z.string().min(1), text: z.string().catch('') })).catch([]),
  }),
  answerSchema: z.object({ optionIds: z.array(z.string()).length(1) }),
  createContent: () => ({ options: Array.from({ length: 3 }, () => ({ id: newOptionId(), text: '' })) }),
  validate: (content) => choiceIssues(content.options),
  evaluate: () => null,
  convertFrom(q) {
    if (q.type === 'poll') return q.content
    const texts = optionTextsOf(q)
    return texts.length ? { options: texts.map((text) => ({ id: newOptionId(), text })) } : pollDefinition.createContent()
  },
}
