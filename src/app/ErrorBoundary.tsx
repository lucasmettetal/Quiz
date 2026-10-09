import { Component, type ReactNode } from 'react'
import { useRouteError } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/i18n/I18nProvider'

function CrashScreen() {
  const t = useT()
  return (
    <div role="alert" className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 grid size-20 rotate-6 place-items-center rounded-md border-2 border-edge bg-primary font-display text-5xl font-black text-white shadow-block">
          !
        </div>
        <h1 className="text-2xl font-bold">{t('errors.boundaryTitle')}</h1>
        <p className="mt-2 text-fg-muted">{t('errors.boundaryText')}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </Button>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    return this.state.error ? <CrashScreen /> : this.props.children
  }
}

/** Router-level error element (thrown loaders, lazy chunk failures…). */
export function RouteError() {
  const error = useRouteError()
  console.error(error)
  return <CrashScreen />
}
