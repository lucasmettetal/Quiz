import { describe, expect, it } from 'vitest'
import { normalizeTextAnswer } from './definitions'
import type { QuestionOf } from './model'
import { convertQuestion, createQuestion, evaluateAnswer, questionFromRow, questionIssues } from './registry'

function quiz(options: Array<[string, boolean]>, prompt = 'Q ?'): QuestionOf<'quiz'> {
  return {
    id: 'q', type: 'quiz', prompt, media: null, time_limit_s: 20, points: 1000,
    content: { options: options.map(([text, correct], i) => ({ id: `o${i}`, text, correct })) },
  }
}

describe('question validation (mirrors SQL question_issues)', () => {
  it('flags the same issues, in the same order', () => {
    expect(questionIssues(quiz([['', false]], ''))).toEqual(['prompt_empty', 'options_count', 'option_empty', 'no_correct'])
    expect(questionIssues(quiz([['A', true], ['B', false]]))).toEqual([])
  })

  it('new questions are invalid until filled', () => {
    expect(questionIssues(createQuestion('quiz'))).toContain('prompt_empty')
    expect(questionIssues(createQuestion('text'))).toEqual(['prompt_empty', 'accepted_empty'])
    expect(questionIssues({ ...createQuestion('true_false'), prompt: 'Vrai ?' })).toEqual([])
  })
})

describe('answer evaluation', () => {
  it('requires the exact set of correct options', () => {
    const q = quiz([['A', true], ['B', true], ['C', false]])
    expect(evaluateAnswer(q, { optionIds: ['o0', 'o1'] })).toBe(true)
    expect(evaluateAnswer(q, { optionIds: ['o1', 'o0'] })).toBe(true)
    expect(evaluateAnswer(q, { optionIds: ['o0'] })).toBe(false)
    expect(evaluateAnswer(q, { optionIds: ['o0', 'o1', 'o2'] })).toBe(false)
  })

  it('compares typed answers ignoring case and extra spaces', () => {
    const q: QuestionOf<'text'> = { ...createQuestion('text'), type: 'text', content: { accepted: ['New  York', 'NYC'], caseSensitive: false } }
    expect(evaluateAnswer(q, { text: '  new york ' })).toBe(true)
    expect(evaluateAnswer(q, { text: 'nyc' })).toBe(true)
    expect(evaluateAnswer(q, { text: 'Boston' })).toBe(false)
    expect(evaluateAnswer({ ...q, content: { ...q.content, caseSensitive: true } }, { text: 'nyc' })).toBe(false)
    expect(normalizeTextAnswer(' A\t B ')).toBe('a b')
  })

  it('never grades polls', () => {
    const poll = createQuestion('poll') as QuestionOf<'poll'>
    expect(evaluateAnswer(poll, { optionIds: [poll.content.options[0]!.id] })).toBeNull()
  })
})

describe('type conversion', () => {
  it('keeps prompt and compatible answers', () => {
    const q = quiz([['Paris', true], ['Lyon', false]], 'Capitale ?')
    const asText = convertQuestion(q, 'text')
    expect(asText).toMatchObject({ prompt: 'Capitale ?', type: 'text', content: { accepted: ['Paris'] } })
    const asPoll = convertQuestion(q, 'poll')
    expect(asPoll.points).toBe(0)
    expect(asPoll.type === 'poll' && asPoll.content.options.map((o) => o.text)).toEqual(['Paris', 'Lyon'])
    const back = convertQuestion(asPoll, 'quiz')
    expect(back.points).toBe(1000)
  })
})

describe('questionFromRow', () => {
  it('repairs malformed content and rejects unknown types', () => {
    const q = questionFromRow({ id: 'x', type: 'quiz', prompt: 'p', media: null, time_limit_s: 20, points: 1000, content: { options: 'nope' } })
    expect(q?.type === 'quiz' && q.content.options).toEqual([])
    expect(questionFromRow({ id: 'x', type: 'slider', prompt: '', media: null, time_limit_s: 20, points: 0, content: {} })).toBeNull()
  })
})
