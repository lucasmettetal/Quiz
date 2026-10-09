import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/Toaster'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/i18n/I18nProvider'
import { AppError } from '@/lib/errors'
import { ErrorBoundary } from './ErrorBoundary'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't hammer the server for errors that won't fix themselves.
      retry: (count, error) =>
        count < 2 && !(error instanceof AppError && error.code !== 'NETWORK' && error.code !== 'UNKNOWN'),
    },
  },
})

export function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* reducedMotion="user" turns transform animations off for prefers-reduced-motion */}
            <MotionConfig reducedMotion="user">
              <RouterProvider router={router} />
              <Toaster />
            </MotionConfig>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </I18nProvider>
  )
}
