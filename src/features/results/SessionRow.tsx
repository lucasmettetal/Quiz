import { ArrowRight, Radio } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/misc'
import { formatDate } from '@/lib/format'
import { useI18n } from '@/i18n/I18nProvider'
import type { SessionSummary } from '@/services/games'

/** One past or running game in a history list. */
export function SessionRow({ session }: { session: SessionSummary }) {
  const { t, locale } = useI18n()
  const live = session.state !== 'FINISHED' && session.state !== 'FINAL_RESULTS'
  const href = live ? `/host/${session.id}` : `/app/results/${session.id}`
  return (
    <li className="group relative flex items-center gap-4 rounded-md border-2 border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-fg-subtle">
      <span
        aria-hidden="true"
        className={
          live
            ? 'grid size-10 shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-lime text-ink'
            : 'grid size-10 shrink-0 -rotate-6 place-items-center rounded-sm border-2 border-edge bg-surface-2 font-display font-bold text-fg'
        }
      >
        {live ? <Radio className="size-5" /> : session.playerCount}
      </span>
      <div className="min-w-0 flex-1">
        <Link to={href} className="block truncate font-semibold after:absolute after:inset-0 hover:underline">
          {session.quiz_title}
        </Link>
        <p className="text-xs text-fg-muted">
          {formatDate(session.created_at, locale)} · {t('common.players', { count: session.playerCount })}
        </p>
      </div>
      {live ? <Badge tone="primary">{t('results.inProgress')}</Badge> : <Badge>{t('results.finished')}</Badge>}
      <ArrowRight className="size-4 text-fg-subtle transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
    </li>
  )
}
