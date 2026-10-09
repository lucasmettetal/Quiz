import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Download, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageContainer } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ErrorState } from '@/components/ui/States'
import { Avatar, Badge, Skeleton } from '@/components/ui/misc'
import { questionFromRow, questionTypes } from '@/features/questions/registry'
import type { Question } from '@/features/questions/model'
import { QUESTION_TYPE_META } from '@/features/questions/ui/typeMeta'
import { answerDistribution, buildReport, playersCsv, type QuestionStats } from '@/features/results/stats'
import { sortLeaderboard } from '@/features/game/engine/events'
import { deleteSession, getSession, getSessionAnswers, getSessionPlayers, getSessionQuestions } from '@/services/games'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import { COLOR_CLASSES, answerSlot } from '@/lib/palette'
import { useI18n } from '@/i18n/I18nProvider'
import type { PlayerAnswer } from '@/types/database'

type ReportQuestion = Question & { position: number }

async function loadReport(sessionId: string) {
  const [session, rows, players, answers] = await Promise.all([
    getSession(sessionId),
    getSessionQuestions(sessionId),
    getSessionPlayers(sessionId),
    getSessionAnswers(sessionId),
  ])
  const questions = rows.flatMap((r) => {
    const q = questionFromRow(r)
    return q ? [{ ...q, position: r.position }] : []
  })
  return { session, questions, players, answers }
}

function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <dt className="text-xs font-semibold tracking-wide text-paper/60 uppercase">{label}</dt>
      <dd className="font-display text-3xl font-extrabold tabular">{value}</dd>
    </div>
  )
}

/** Horizontal bar, labelled with its value — real counts, no decoration. */
function Bar({ ratio, className }: { ratio: number; className?: string }) {
  return (
    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
      <div className={cn('h-full rounded-full transition-[width] duration-500', className)} style={{ width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` }} />
    </div>
  )
}

function QuestionReport({ question, stats, answers, playerCount }: { question: ReportQuestion; stats: QuestionStats; answers: PlayerAnswer[]; playerCount: number }) {
  const { t, locale } = useI18n()
  const meta = QUESTION_TYPE_META[question.type]
  const labels = { true: t('questionTypes.trueFalse.true'), false: t('questionTypes.trueFalse.false') }
  const distribution = answerDistribution(question, answers.filter((a) => a.game_question_id === question.id), labels)
  const max = Math.max(1, ...distribution.map((b) => b.count))
  return (
    <li className="rounded-lg border-2 border-line bg-surface p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn('grid size-9 shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-edge font-display font-bold', COLOR_CLASSES[meta.color].bg, COLOR_CLASSES[meta.color].on)}>
          {question.position + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fg-subtle">{t(`questionTypes.${question.type}.name`)}</p>
          <h3 className="font-display text-lg font-bold">{question.prompt}</h3>
        </div>
        <div className="text-right">
          {stats.accuracy !== null ? (
            <p className="font-display text-2xl font-black tabular">{formatPercent(stats.accuracy, locale)}</p>
          ) : (
            <Badge>{t('results.poll')}</Badge>
          )}
          <p className="text-xs text-fg-muted">
            {t('results.answered')} {stats.answered}/{playerCount}
            {stats.avgElapsedMs !== null && ` · ${(stats.avgElapsedMs / 1000).toFixed(1)} s`}
          </p>
        </div>
      </div>
      {distribution.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {distribution.map((b, i) => (
            <li key={b.key} className="flex items-center gap-3 text-sm">
              <span className="w-44 truncate sm:w-60">
                {(question.type === 'quiz' || question.type === 'poll') && <span className="mr-1.5 font-display font-bold text-fg-subtle">{answerSlot(i).letter}</span>}
                {b.label}
              </span>
              <Bar ratio={b.count / max} className={questionTypes[question.type].graded ? (b.correct ? 'bg-success' : 'bg-fg-subtle') : 'bg-amber'} />
              <span className="w-8 text-right font-semibold tabular">{b.count}</span>
              <span className="w-5">{b.correct && questionTypes[question.type].graded && <Check className="size-4 text-success" aria-label={t('host.correctAnswer')} />}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function ReportPage() {
  const { sessionId = '' } = useParams()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const query = useQuery({ queryKey: ['report', sessionId], queryFn: () => loadReport(sessionId) })

  const report = useMemo(() => (query.data ? buildReport(query.data.questions, query.data.players, query.data.answers) : null), [query.data])

  if (query.isPending) {
    return (
      <PageContainer>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </PageContainer>
    )
  }
  if (query.isError || !report) {
    return (
      <PageContainer>
        <ErrorState error={query.error} title={t('results.notFoundTitle')} />
      </PageContainer>
    )
  }

  const { session, questions, players, answers } = query.data
  const ranked = sortLeaderboard(players)
  const byId = new Map(questions.map((q) => [q.id, q]))

  function exportCsv() {
    const csv = playersCsv(questions, players, answers, {
      rank: t('results.rank'),
      player: t('results.player'),
      score: t('results.score'),
      correct: t('results.correctAnswers'),
      question: (n) => `Q${n}`,
    })
    const date = new Date(session.created_at).toISOString().slice(0, 10)
    const slug = session.quiz_title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quiz'
    downloadCsv(`tilt-${slug}-${date}.csv`, csv)
  }

  return (
    <PageContainer>
      <div>
        <Link to="/app/results" className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {t('results.title')}
        </Link>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-4xl font-extrabold">{session.quiz_title}</h1>
            <p className="mt-1 text-fg-muted">
              {formatDate(session.created_at, locale)} · PIN {session.pin}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)}>
              {t('results.delete')}
            </Button>
            <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={players.length === 0}>
              {t('results.exportCsv')}
            </Button>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border-2 border-edge bg-stage text-stage-fg shadow-block md:grid-cols-4 [&>div+div]:border-l-2 [&>div+div]:border-white/10">
        <Stat label={t('results.participants')} value={formatNumber(report.playerCount, locale)} />
        <Stat label={t('results.accuracy')} value={report.accuracy === null ? '—' : formatPercent(report.accuracy, locale)} />
        <Stat label={t('results.avgScore')} value={formatNumber(report.avgScore, locale)} />
        <Stat label={t('results.avgTime')} value={report.avgElapsedMs === null ? '—' : `${(report.avgElapsedMs / 1000).toFixed(1)} s`} />
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section aria-labelledby="per-question">
          <h2 id="per-question" className="mb-3 text-2xl font-bold">
            {t('results.perQuestion')}
          </h2>
          <ol className="flex flex-col gap-3">
            {questions.map((q, i) => (
              <QuestionReport key={q.id} question={q} stats={report.questions[i]!} answers={answers} playerCount={report.playerCount} />
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-8">
          <section aria-labelledby="leaderboard">
            <h2 id="leaderboard" className="mb-3 text-2xl font-bold">
              {t('results.leaderboard')}
            </h2>
            <ol className="overflow-hidden rounded-lg border-2 border-line bg-surface">
              {ranked.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                  <span className="w-6 text-center font-display font-black tabular">{p.rank ?? '–'}</span>
                  <Avatar name={p.nickname} color={p.avatar} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.nickname}</span>
                  {p.status !== 'active' && <Badge>{t(`results.status.${p.status}`)}</Badge>}
                  <span className="text-xs text-fg-muted tabular">
                    {p.correct_count} <Check className="inline size-3" aria-label={t('results.correctAnswers')} />
                  </span>
                  <span className="w-16 text-right font-display font-bold tabular">{formatNumber(p.score, locale)}</span>
                </li>
              ))}
              {ranked.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-muted">{t('host.nobodyAnswered')}</li>}
            </ol>
          </section>

          {report.hardest.length > 0 && (
            <section aria-labelledby="hardest">
              <h2 id="hardest" className="mb-3 text-2xl font-bold">
                {t('results.hardest')}
              </h2>
              <ol className="flex flex-col gap-2">
                {report.hardest.map((s) => {
                  const q = byId.get(s.questionId)
                  return (
                    <li key={s.questionId} className="rounded-md border-2 border-line bg-surface p-3">
                      <p className="line-clamp-2 text-sm font-semibold">
                        {s.position + 1}. {q?.prompt}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Bar ratio={s.accuracy ?? 0} className="bg-vermilion" />
                        <span className="font-bold tabular">{formatPercent(s.accuracy ?? 0, locale)}</span>
                      </div>
                      {s.mostChosen && (
                        <p className="mt-1 text-xs text-fg-muted">
                          {t('results.mostChosen')} · <span className="font-semibold text-fg">{s.mostChosen.label}</span>
                        </p>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('results.deleteTitle')}
        description={t('results.deleteText')}
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          await deleteSession(sessionId)
          void queryClient.invalidateQueries({ queryKey: ['sessions'] })
          navigate('/app/results', { replace: true })
        }}
      />
    </PageContainer>
  )
}
