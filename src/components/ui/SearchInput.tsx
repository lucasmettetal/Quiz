import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import { Input } from './Field'

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  const t = useT()
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={t('common.search')}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-sm text-fg-subtle hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
