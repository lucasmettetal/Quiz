import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { questionIssues } from '@/features/questions/registry'
import { convertKahoot, extractKahootId } from './kahoot'
import { nearestTimeLimit, plainText } from './model'
import { parseCsv, tableToDraft } from './table'
import { readXlsx } from './xlsx'

const ID = '0b6a2f38-6e2c-4d8a-9f1e-5c3d2b1a0f99'

describe('extractKahootId', () => {
  it('accepts the usual Kahoot URLs only', () => {
    expect(extractKahootId(`https://create.kahoot.it/details/${ID}`)).toBe(ID)
    expect(extractKahootId(`https://create.kahoot.it/share/capitales/${ID.toUpperCase()}`)).toBe(ID)
    expect(extractKahootId(`https://play.kahoot.it/v2/?quizId=${ID}&x=1`)).toBe(ID)
    expect(extractKahootId(`https://evil.example/${ID}`)).toBeNull()
    expect(extractKahootId(`https://kahoot.it.evil.example/${ID}`)).toBeNull()
    expect(extractKahootId('pas une url')).toBeNull()
  })
})

describe('convertKahoot', () => {
  const raw = {
    card: { title: 'ignored' },
    kahoot: {
      title: 'Capitales <b>d’Europe</b>',
      description: 'Révisions',
      cover: 'https://images-cdn.kahoot.it/cover.png',
      questions: [
        {
          type: 'quiz', question: 'Capitale du <i>Portugal</i>&nbsp;?', time: 20000, points: true, pointsMultiplier: 2,
          image: 'https://images-cdn.kahoot.it/q1.jpg', imageMetadata: { altText: 'Carte' },
          choices: [{ answer: 'Porto', correct: false }, { answer: 'Lisbonne', correct: true }, { answer: 'Madrid', correct: false }],
        },
        { type: 'quiz', question: 'Berne est la capitale suisse', time: 10000, choices: [{ answer: 'Vrai', correct: true }, { answer: 'Faux', correct: false }] },
        { type: 'open_ended', question: 'Capitale de la Norvège ?', time: 30000, choices: [{ answer: 'Oslo', correct: true }] },
        { type: 'survey', question: 'Envie de voyager ?', time: 20000, points: false, choices: [{ answer: 'Oui' }, { answer: 'Non' }] },
        { type: 'jumble', question: 'Ordre', choices: [] },
        { type: 'content', title: 'Pause' },
        { type: 'quiz', question: 'Images', choices: [{ image: { id: 'x' }, correct: true }, { answer: 'B' }], video: { id: 'yt' } },
      ],
    },
  }

  it('maps types, timers, points and media', () => {
    const draft = convertKahoot(raw)
    expect(draft.title).toBe('Capitales d’Europe')
    expect(draft.coverImageUrl).toBe('https://images-cdn.kahoot.it/cover.png')
    expect(draft.questions.map((q) => q.type)).toEqual(['quiz', 'true_false', 'text', 'poll', 'quiz'])
    const [q1, q2, q3, q4] = draft.questions
    expect(q1).toMatchObject({ prompt: 'Capitale du Portugal ?', points: 2000, time_limit_s: 20, media: { path: 'https://images-cdn.kahoot.it/q1.jpg', alt: 'Carte' } })
    expect(q1!.type === 'quiz' && q1!.content.options.filter((o) => o.correct).map((o) => o.text)).toEqual(['Lisbonne'])
    expect(q2).toMatchObject({ type: 'true_false', content: { correct: true }, time_limit_s: 10 })
    expect(q3).toMatchObject({ type: 'text', content: { accepted: ['Oslo'] } })
    expect(q4).toMatchObject({ type: 'poll', points: 0 })
    expect(questionIssues(q1!)).toEqual([])
  })

  it('reports what could not be imported', () => {
    const { warnings } = convertKahoot(raw)
    expect(warnings).toEqual(
      expect.arrayContaining([
        { code: 'unsupported_type', at: 5, detail: 'jumble' },
        { code: 'unsupported_type', at: 6, detail: 'content' },
        { code: 'image_answers', at: 7 },
        { code: 'video_dropped', at: 7 },
      ]),
    )
  })

  it('survives garbage', () => {
    expect(convertKahoot(null).questions).toEqual([])
    expect(convertKahoot({ kahoot: { questions: 'nope' } }).questions).toEqual([])
  })
})

describe('helpers', () => {
  it('snaps timers and cleans text', () => {
    expect(nearestTimeLimit(25)).toBe(20)
    expect(nearestTimeLimit(200)).toBe(240)
    expect(nearestTimeLimit(NaN)).toBe(20)
    expect(plainText('a<br/>b &amp; c', 50)).toBe('a b & c')
  })
})

describe('spreadsheet import', () => {
  it('parses CSV with quotes and semicolons', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\r\n1;2;3')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2', '3'],
    ])
  })

  it('reads Tilt’s template', () => {
    const csv = [
      'Type,Question,Réponse 1,Réponse 2,Réponse 3,Réponse 4,Bonne(s) réponse(s),Temps (s),Points',
      'quiz,Capitale du Portugal ?,Porto,Lisbonne,Madrid,,2,20,double',
      'vrai-faux,Berne est en Suisse,,,,,vrai,15,',
      'texte,Capitale de la Norvège ?,Oslo,,,,,30,',
      'sondage,On continue ?,Oui,Non,,,,10,',
      ',,,,,,,,',
    ].join('\n')
    const draft = tableToDraft(parseCsv(csv), 'mes_capitales.csv')
    expect(draft.title).toBe('mes capitales')
    expect(draft.questions.map((q) => q.type)).toEqual(['quiz', 'true_false', 'text', 'poll'])
    expect(draft.questions[0]).toMatchObject({ points: 2000, time_limit_s: 20 })
    expect(draft.questions.every((q) => questionIssues(q).length === 0)).toBe(true)
  })

  it('reads Kahoot’s spreadsheet template (header not on first row)', () => {
    const rows = [
      ['Quiz template'],
      [],
      ['', 'Question - max 120 characters', 'Answer 1 - max 75 characters', 'Answer 2 - max 75 characters', 'Answer 3', 'Answer 4', 'Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs', 'Correct answer(s) - choose at least one'],
      ['1', 'Quelle planète est la plus grande ?', 'Mars', 'Jupiter', 'Vénus', '', '30', '2'],
      ['2', 'Lesquelles sont des lunes ?', 'Io', 'Europe', 'Cérès', 'Titan', '60', '1,2,4'],
    ]
    const draft = tableToDraft(rows, 'kahoot.xlsx')
    expect(draft.questions).toHaveLength(2)
    const q2 = draft.questions[1]!
    expect(q2.type === 'quiz' && q2.content.options.map((o) => o.correct)).toEqual([true, true, false, true])
    expect(q2.time_limit_s).toBe(60)
  })

  it('rejects files without a recognizable header', () => {
    expect(() => tableToDraft([['foo', 'bar']], 'x.csv')).toThrow('IMPORT_FILE_INVALID')
  })

  it('reads the first sheet of an XLSX file', () => {
    const files = {
      'xl/workbook.xml': strToU8('<workbook xmlns:r="r"><sheets><sheet name="Q" r:id="rId1"/></sheets></workbook>'),
      'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
      'xl/sharedStrings.xml': strToU8('<sst><si><t>Question</t></si><si><r><t>Answer </t></r><r><t>1</t></r></si><si><t>Capitale ?</t></si></sst>'),
      'xl/worksheets/sheet1.xml': strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
          '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3" t="inlineStr"><is><t>Paris</t></is></c><c r="D3"><v>20</v></c></row></sheetData></worksheet>',
      ),
    }
    const zip = zipSync(files)
    const rows = readXlsx(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer)
    expect(rows[0]).toEqual(['Question', '', 'Answer 1'])
    expect(rows[1]).toEqual([])
    expect(rows[2]).toEqual(['Capitale ?', '', 'Paris', '20'])
    expect(() => readXlsx(new ArrayBuffer(8))).toThrow('IMPORT_FILE_INVALID')
  })
})
