import { BarChart3, Compass, Gamepad2, House, Library, LogOut, Moon, Plus, Settings, Star, Sun } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Button, IconButton } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { Menu } from '@/components/ui/Menu'
import { Avatar } from '@/components/ui/misc'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCreateQuiz } from '@/features/quizzes/useQuizActions'
import { signOut } from '@/services/auth'
import { useThemeStore } from '@/stores/themeStore'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/translate'

const NAV: Array<{ to: string; label: MessageKey; icon: typeof House; end?: boolean }> = [
  { to: '/app', label: 'nav.home', icon: House, end: true },
  { to: '/app/quizzes', label: 'nav.quizzes', icon: Library },
  { to: '/app/explore', label: 'nav.explore', icon: Compass },
  { to: '/app/favorites', label: 'nav.favorites', icon: Star },
  { to: '/app/results', label: 'nav.results', icon: BarChart3 },
]

function ThemeQuickToggle() {
  const t = useT()
  const { resolved, setPreference } = useThemeStore()
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <IconButton
      label={t(next === 'dark' ? 'theme.dark' : 'theme.light')}
      icon={resolved === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
      onClick={() => setPreference(next)}
    />
  )
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  if (!profile) return null
  return (
    <Menu
      align={compact ? 'end' : 'start'}
      className={compact ? '' : 'w-full'}
      items={[
        ...(compact ? [{ label: t('nav.favorites'), icon: <Star />, onSelect: () => navigate('/app/favorites') }] : []),
        { label: t('nav.settings'), icon: <Settings />, onSelect: () => navigate('/app/settings') },
        { label: t('nav.joinGame'), icon: <Gamepad2 />, onSelect: () => window.open('/join', '_blank', 'noopener') },
        {
          label: t('nav.signOut'),
          icon: <LogOut />,
          tone: 'danger',
          onSelect: async () => {
            await signOut()
            navigate('/')
          },
        },
      ]}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={t('nav.account')}
          className={cn(
            'flex items-center gap-3 rounded-md text-left transition-colors hover:bg-surface-2',
            compact ? 'p-1' : 'w-full p-2',
          )}
        >
          <Avatar name={profile.display_name} color={profile.avatar_color} size={compact ? 'sm' : 'md'} />
          {!compact && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{profile.display_name}</span>}
        </button>
      )}
    />
  )
}

function CreateButton({ className }: { className?: string }) {
  const t = useT()
  const create = useCreateQuiz()
  return (
    <Button className={className} icon={<Plus className="size-5" />} loading={create.isPending} onClick={() => create.mutate()}>
      {t('nav.createQuiz')}
    </Button>
  )
}

export function AppShell() {
  const t = useT()
  const create = useCreateQuiz()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2">
        {t('common.skipToContent')}
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r-2 border-line bg-surface px-4 py-5 lg:flex">
        <NavLink to="/app" className="mb-7 self-start px-2" aria-label={t('nav.home')}>
          <Logo className="text-3xl" />
        </NavLink>
        <CreateButton className="mb-6 w-full" />
        <nav aria-label={t('nav.main')} className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors duration-150',
                  isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-1/2 -left-4 h-5 w-1.5 -translate-y-1/2 rounded-r-sm bg-primary transition-transform duration-200',
                      isActive ? 'scale-y-100' : 'scale-y-0',
                    )}
                  />
                  <Icon className={cn('size-5 transition-transform duration-200', isActive && '-rotate-6 text-primary-ink')} />
                  {t(label)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t-2 border-line pt-4">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <UserMenu />
            </div>
            <ThemeQuickToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <NavLink to="/app" aria-label={t('nav.home')}>
          <Logo />
        </NavLink>
        <div className="flex items-center gap-1">
          <ThemeQuickToggle />
          <UserMenu compact />
        </div>
      </header>

      <main id="main" className="min-w-0 pb-24 lg:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom navigation with the create action in the middle */}
      <nav
        aria-label={t('nav.main')}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.filter((n) => n.to !== '/app/favorites').slice(0, 2).map((item) => (
          <MobileNavItem key={item.to} {...item} />
        ))}
        <div className="grid place-items-center">
          <button
            type="button"
            aria-label={t('nav.createQuiz')}
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="-mt-6 grid size-14 -rotate-6 place-items-center rounded-md border-2 border-edge bg-primary text-white shadow-block transition-transform active:translate-y-0.5 active:shadow-none"
          >
            <Plus className="size-7" />
          </button>
        </div>
        {NAV.filter((n) => n.to === '/app/explore' || n.to === '/app/results').map((item) => (
          <MobileNavItem key={item.to} {...item} />
        ))}
      </nav>
    </div>
  )
}

function MobileNavItem({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  const t = useT()
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', isActive ? 'text-primary-ink' : 'text-fg-muted')
      }
    >
      <Icon className="size-5" />
      {t(label)}
    </NavLink>
  )
}
