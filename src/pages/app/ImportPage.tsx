import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Download, FileSpreadsheet, Link2, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router'
import { PageContainer, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { Badge, PatternBlock } from '@/components/ui/misc'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/AuthProvider'
import type { ImportDraft } from '@/features/import/model'
import { extractKahootId } from '@/features/import/kahoot'
import { templateRows } from '@/features/import/table'
import { questionIssues } from '@/features/questions/registry'
import type { Question } from '@/features/questions/model'
import { QuestionSummary } from '@/features/questions/ui/QuestionSummary'
import { quizKeys } from '@/features/quizzes/useQuizActions'
import { toCsv } from '@/features/results/stats'
import { fetchKahootDraft, importDraft, readFileDraft } from '@/services/importer'
import { toAppError } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'

function SourceCard({ title, text, icon, color, pattern, children }: {
  title: string
  text: string
  icon: React.ReactNode
  color: 'cobalt' | 'teal'
  pattern: 'dots' | 'waves'
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border-2 border-edge bg-surface">
      <PatternBlock color={color} pattern={pattern} intensity="subtle" className="flex items-center gap-3 border-b-2 border-edge px-5 py-4">
        <span className="grid size-11 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-paper text-ink">{icon}</span>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-sm opacity-90">{text}</p>
        </div>
      </PatternBlock>
      <div className="flex flex-1 flex-col gap-3 p-5">{children}</div>
    </section>
  )
}

export function ImportPage() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profile } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [loading, setLoading] = useState<'kahoot' | 'file' | null>(null)
  const [error, setError] = useState<{ source: 'kahoot' | 'file'; message: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)

  async function load(source: 'kahoot' | 'file', task: () => Promise<ImportDraft>) {
    setLoading(source)
    setError(null)
    try {
      setDraft(await task())
    } catch (e) {
      setError({ source, message: t(`errors.${toAppError(e).code}`) })
    } finally {
      setLoading(null)
    }
  }

  function submitUrl(e: FormEvent) {
    e.preventDefault()
    if (!extractKahootId(url)) return setError({ source: 'kahoot', message: t('errors.KAHOOT_URL_INVALID') })
    void load('kahoot', () => fetchKahootDraft(url))
  }

  function onFile(file: File | undefined) {
    if (file) void load('file', () => readFileDraft(file))
  }

  function downloadTemplate() {
    const rows = templateRows({
      type: t('import.template_type'),
      question: t('import.template_question'),
      answer: (n) => t('import.template_answer', { n }),
      correct: t('import.template_correct'),
      time: t('import.template_time'),
      points: t('import.template_points'),
      examples: [
        ['quiz', t('editor.promptPlaceholder'), 'A', 'B', 'C', 'D', '', '', '1', '20', '1000'],
        ['vrai-faux', t('editor.promptPlaceholder'), '', '', '', '', '', '', t('questionTypes.trueFalse.true'), '15', '1000'],
        ['texte', t('editor.promptPlaceholder'), t('questionTypes.textEditor.acceptedPlaceholder'), '', '', '', '', '', '', '30', '2000'],
        ['sondage', t('editor.promptPlaceholder'), 'A', 'B', 'C', '', '', '', '', '20', '0'],
      ],
    })
    const href = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = href
    a.download = 'tilt-modele-import.csv'
    a.click()
    URL.revokeObjectURL(href)
  }

  function updateQuestion(q: Question) {
    setDraft((d) => (d ? { ...d, questions: d.questions.map((x) => (x.id === q.id ? q : x)) } : d))
  }

  async function confirmImport() {
    if (!draft || !profile) return
    setImporting(t('import.importing'))
    try {
      const id = await importDraft(draft, profile.id, (done, total) => setImporting(t('import.copyingImages', { done, total })))
      void queryClient.invalidateQueries({ queryKey: quizKeys.all })
      toast({ message: t('import.done') })
      navigate(`/editor/${id}`)
    } catch (e) {
      toast({ tone: 'error', message: t(`errors.${toAppError(e).code}`) })
      setImporting(null)
    }
  }

  if (draft) {
    const invalid = draft.questions.filter((q) => questionIssues(q).length > 0).length
    return (
      <PageContainer>
        <PageHeader
          title={t('import.previewTitle')}
          lead={t('import.previewLead')}
          actions={
            <>
              <Button variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setDraft(null)} disabled={Boolean(importing)}>
                {t('import.restart')}
              </Button>
              <Button icon={<Upload className="size-4" />} onClick={confirmImport} loading={Boolean(importing)} disabled={draft.questions.length === 0}>
                {importing ?? t('import.confirm')}
              </Button>
            </>
          }
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('editor.meta.title')}</span>
              <Input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="font-display text-xl font-bold" />
            </label>
            <ol className="flex flex-col gap-2">
              {draft.questions.map((q, i) => (
                <li key={q.id}>
                  <QuestionSummary as="div" question={q} index={i} showAnswers />
                  <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                    <Input
                      value={q.prompt}
                      maxLength={500}
                      aria-label={`${t('editor.promptLabel')} ${i + 1}`}
                      onChange={(e) => updateQuestion({ ...q, prompt: e.target.value })}
                      className="h-9 flex-1 text-sm"
                    />
                    {questionIssues(q).map((issue) => (
                      <Badge key={issue} tone="danger">
                        {t(`editor.issues.${issue}`)}
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="size-4" />}
                      onClick={() => setDraft({ ...draft, questions: draft.questions.filter((x) => x.id !== q.id) })}
                    >
                      {t('import.removeQuestion')}
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border-2 border-line bg-surface p-4">
              <p className="text-sm font-semibold text-fg-muted">{draft.source === 'kahoot' ? t('import.sourceKahoot') : t('import.sourceFile')}</p>
              <p className="mt-1 font-display text-2xl font-black">{t('common.questions', { count: draft.questions.length })}</p>
              {invalid > 0 && <p className="mt-1 text-sm font-semibold text-warning-ink">{t('editor.issuesCount', { count: invalid })}</p>}
            </div>
            {draft.warnings.length > 0 && (
              <div className="rounded-lg border-2 border-amber bg-surface p-4">
                <h2 className="mb-2 flex items-center gap-2 font-bold">
                  <AlertTriangle className="size-4 text-warning-ink" aria-hidden="true" /> {t('import.warningsTitle')}
                </h2>
                <ul className="flex flex-col gap-1.5 text-sm text-fg-muted">
                  {draft.warnings.map((w, i) => (
                    <li key={i}>{t(`import.warning.${w.code}`, { at: w.at, detail: w.detail ?? '' })}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader title={t('import.title')} lead={t('import.lead')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <SourceCard title={t('import.kahootTitle')} text={t('import.kahootText')} icon={<Link2 className="size-5" />} color="cobalt" pattern="dots">
          <form onSubmit={submitUrl} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('import.kahootPlaceholder')}
              aria-label={t('import.kahootText')}
              aria-invalid={error?.source === 'kahoot' || undefined}
            />
            <Button type="submit" loading={loading === 'kahoot'} disabled={!url.trim() || loading !== null}>
              {t('import.kahootFetch')}
            </Button>
          </form>
          {error?.source === 'kahoot' && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
              {error.message}
            </p>
          )}
          <p className="mt-auto text-xs text-fg-muted">{t('import.kahootNote')}</p>
        </SourceCard>

        <SourceCard title={t('import.fileTitle')} text={t('import.fileText')} icon={<FileSpreadsheet className="size-5" />} color="teal" pattern="waves">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e: DragEvent) => {
              e.preventDefault()
              setDragOver(false)
              onFile(e.dataTransfer.files[0])
            }}
            disabled={loading !== null}
            className={cn(
              'flex min-h-28 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 text-center text-sm font-semibold transition-colors duration-150',
              dragOver ? 'border-teal bg-teal/5' : 'border-line hover:border-fg-subtle',
            )}
          >
            {loading === 'file' ? <Spinner className="size-6 text-teal" label={t('import.reading')} /> : <Upload className="size-6 text-fg-subtle" aria-hidden="true" />}
            {loading === 'file' ? t('import.reading') : t('import.fileDrop')}
          </button>
          <input
            ref={fileInput}
            type="file"
            aria-label={t('import.fileTitle')}
            accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {error?.source === 'file' && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
              {error.message}
            </p>
          )}
          <Button variant="ghost" size="sm" className="mt-auto self-start" icon={<Download className="size-4" />} onClick={downloadTemplate}>
            {t('import.template')}
          </Button>
        </SourceCard>
      </div>
    </PageContainer>
  )
}
