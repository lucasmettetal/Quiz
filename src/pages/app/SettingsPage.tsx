import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageContainer, PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toaster'
import { SegmentedControl } from '@/components/ui/misc'
import { profileQueryKey, useAuth } from '@/features/auth/AuthProvider'
import { displayNameSchema } from '@/features/auth/authForms'
import { updateProfile } from '@/services/auth'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'
import { cn } from '@/lib/cn'
import { toAppError } from '@/lib/errors'
import { COLOR_CLASSES, PALETTE, type PaletteColor } from '@/lib/palette'
import { useI18n } from '@/i18n/I18nProvider'
import type { Locale } from '@/i18n/translate'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border-2 border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n()
  const { profile, session } = useAuth()
  const queryClient = useQueryClient()
  const { preference, setPreference } = useThemeStore()
  const [name, setName] = useState(profile!.display_name)
  const [color, setColor] = useState<PaletteColor>(profile!.avatar_color)
  const [nameError, setNameError] = useState(false)

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateProfile>[1]) => updateProfile(profile!.id, patch),
    onSuccess: (p) => queryClient.setQueryData(profileQueryKey(p.id), p),
  })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!displayNameSchema.safeParse(name).success) return setNameError(true)
    setNameError(false)
    try {
      await save.mutateAsync({ display_name: name.trim(), avatar_color: color })
      toast({ message: t('settings.saved') })
    } catch (err) {
      toast({ tone: 'error', message: t(`errors.${toAppError(err).code}`) })
    }
  }

  function changeLocale(next: Locale) {
    setLocale(next)
    save.mutate({ locale: next })
  }

  return (
    <PageContainer>
      <PageHeader title={t('settings.title')} />
      <div className="grid max-w-2xl gap-6">
        <Section title={t('settings.profile')}>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <TextField
              label={t('settings.displayName')}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              error={nameError && t('auth.validation.name')}
            />
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t('settings.avatarColor')}</legend>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="avatar" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" />
                    <span
                      title={t(`colors.${c}`)}
                      className={cn(
                        'grid size-10 place-items-center rounded-sm border-2 transition-transform duration-150 peer-focus-visible:outline-3 peer-focus-visible:outline-cobalt',
                        COLOR_CLASSES[c].bg,
                        color === c ? '-rotate-6 border-edge shadow-block-sm' : 'border-transparent hover:-rotate-3',
                      )}
                    >
                      <span className="sr-only">{t(`colors.${c}`)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="self-start" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </form>
        </Section>

        <Section title={t('settings.appearance')}>
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t('theme.label')}</span>
              <SegmentedControl<ThemePreference>
                label={t('theme.label')}
                value={preference}
                onChange={setPreference}
                className="self-start"
                options={[
                  { value: 'light', label: t('theme.light'), icon: <Sun className="size-4" /> },
                  { value: 'dark', label: t('theme.dark'), icon: <Moon className="size-4" /> },
                  { value: 'system', label: t('theme.system'), icon: <Monitor className="size-4" /> },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t('settings.language')}</span>
              <SegmentedControl<Locale>
                label={t('settings.language')}
                value={locale}
                onChange={changeLocale}
                className="self-start"
                options={[
                  { value: 'fr', label: t('locale.fr') },
                  { value: 'en', label: t('locale.en') },
                ]}
              />
            </div>
          </div>
        </Section>

        <Section title={t('settings.account')}>
          <p className="text-sm text-fg-muted">{t('settings.email', { email: session?.user.email ?? '—' })}</p>
          <h3 className="mt-5 mb-3 text-base font-bold">{t('settings.changePassword')}</h3>
          <ChangePasswordForm />
        </Section>
      </div>
    </PageContainer>
  )
}
