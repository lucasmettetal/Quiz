import type { ReactNode } from 'react'

export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {lead && <p className="mt-1 text-fg-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 lg:py-10">{children}</div>
}
