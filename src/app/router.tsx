import type { ComponentType } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { RedirectIfCreator, RequireCreator } from '@/features/auth/RequireCreator'
import { RouteError } from './ErrorBoundary'

/** Route-level code splitting: each page is its own chunk. */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) })
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', lazy: page(() => import('@/pages/LandingPage'), (m) => m.LandingPage) },
      {
        path: '/auth',
        element: (
          <RedirectIfCreator>
            <Outlet />
          </RedirectIfCreator>
        ),
        children: [
          { path: 'login', lazy: page(() => import('@/pages/auth/LoginPage'), (m) => m.LoginPage) },
          { path: 'signup', lazy: page(() => import('@/pages/auth/SignupPage'), (m) => m.SignupPage) },
          { path: 'forgot', lazy: page(() => import('@/pages/auth/ForgotPasswordPage'), (m) => m.ForgotPasswordPage) },
        ],
      },
      // Reset & callback must stay reachable while a (recovery) session exists.
      { path: '/auth/reset', lazy: page(() => import('@/pages/auth/ResetPasswordPage'), (m) => m.ResetPasswordPage) },
      { path: '/auth/callback', lazy: page(() => import('@/pages/auth/AuthCallbackPage'), (m) => m.AuthCallbackPage) },
      {
        path: '/app',
        element: (
          <RequireCreator>
            <AppShell />
          </RequireCreator>
        ),
        children: [
          { index: true, lazy: page(() => import('@/pages/app/DashboardPage'), (m) => m.DashboardPage) },
          { path: 'quizzes', lazy: page(() => import('@/pages/app/QuizzesPage'), (m) => m.QuizzesPage) },
          { path: 'explore', lazy: page(() => import('@/pages/app/ExplorePage'), (m) => m.ExplorePage) },
          { path: 'favorites', lazy: page(() => import('@/pages/app/FavoritesPage'), (m) => m.FavoritesPage) },
          { path: 'import', lazy: page(() => import('@/pages/app/ImportPage'), (m) => m.ImportPage) },
          { path: 'results', lazy: page(() => import('@/pages/app/ResultsPage'), (m) => m.ResultsPage) },
          { path: 'results/:sessionId', lazy: page(() => import('@/pages/app/ReportPage'), (m) => m.ReportPage) },
          { path: 'settings', lazy: page(() => import('@/pages/app/SettingsPage'), (m) => m.SettingsPage) },
        ],
      },
      {
        path: '/editor/:quizId',
        element: (
          <RequireCreator>
            <Outlet />
          </RequireCreator>
        ),
        children: [{ index: true, lazy: page(() => import('@/pages/EditorPage'), (m) => m.EditorPage) }],
      },
      {
        path: '/host/:sessionId',
        element: (
          <RequireCreator>
            <Outlet />
          </RequireCreator>
        ),
        children: [{ index: true, lazy: page(() => import('@/pages/HostPage'), (m) => m.HostPage) }],
      },
      { path: '/join', lazy: page(() => import('@/pages/JoinPage'), (m) => m.JoinPage) },
      { path: '/join/:pin', lazy: page(() => import('@/pages/JoinPage'), (m) => m.JoinPage) },
      { path: '/play/:sessionId', lazy: page(() => import('@/pages/PlayPage'), (m) => m.PlayPage) },
      { path: '/quiz/:quizId', lazy: page(() => import('@/pages/QuizDetailPage'), (m) => m.QuizDetailPage) },
      { path: '*', lazy: page(() => import('@/pages/NotFoundPage'), (m) => m.NotFoundPage) },
    ],
  },
])
