import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Palette, Shuffle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { Spinner } from '@/components/ui/Spinner'
import { PinForm } from '@/features/game/player/PinForm'
import { ensurePlayerIdentity } from '@/services/auth'
import { findSession, joinSession, type FoundSession } from '@/services/play'
import { toAppError, type AppErrorCode } from '@/lib/errors'
import { cn } from '@/lib/cn'
import { safeStorage } from '@/lib/storage'
import { generateAvatarFromSeed, parseAvatarConfig, randomAvatar, serializeAvatar, type AvatarConfig } from '@/features/avatars/avatar'
import { AvatarEditor, AvatarPreview } from '@/features/avatars/AvatarEditor'
import { useT } from '@/i18n/I18nProvider'

const NICK_KEY = 'tilt.nickname'

const secondaryAction =
  'inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-md border-2 border-white/40 px-3 text-sm font-bold text-paper ' +
  'transition-colors duration-150 hover:border-paper hover:bg-white/5 active:translate-y-px'
/** A customized avatar is remembered on this device; an automatic one follows the nickname. */
const AVATAR_KEY = 'tilt.avatar.config'

function storedAvatar(): AvatarConfig | null {
  try {
    return parseAvatarConfig(JSON.parse(safeStorage.get(AVATAR_KEY) ?? 'null'))
  } catch {
    return null
  }
}

export function JoinPage() {
  const { pin: pinParam } = useParams()
  const t = useT()
  const navigate = useNavigate()
  const [pin, setPin] = useState<string | null>(pinParam && /^\d{6}$/.test(pinParam) ? pinParam : null)
  const [found, setFound] = useState<FoundSession | null>(null)
  const [error, setError] = useState<AppErrorCode | null>(null)
  const [checking, setChecking] = useState(Boolean(pin))
  const [nickname, setNickname] = useState(() => safeStorage.get(NICK_KEY) ?? '')
  // null = automatic avatar derived from the nickname (updates as you type).
  const [customAvatar, setCustomAvatar] = useState<AvatarConfig | null>(storedAvatar)
  const [editing, setEditing] = useState(false)
  const customizeButton = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  function openEditor() {
    setEditing(true)
    // Move focus into the panel (on the selected category) once it is interactive.
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true }))
  }

  function closeEditor() {
    setEditing(false)
    requestAnimationFrame(() => customizeButton.current?.focus())
  }
  const autoAvatar = generateAvatarFromSeed(nickname.trim() || 'tilt')
  const avatar = customAvatar ?? autoAvatar
  const [joining, setJoining] = useState(false)

  // Validate the PIN as soon as we have one (typed or from a shared link / QR code).
  useEffect(() => {
    if (!pin) return
    let cancelled = false
    findSession(pin)
      .then((s) => {
        if (cancelled) return
        if (!s) setError('PIN_NOT_FOUND')
        else if (s.reason) setError(s.reason as AppErrorCode)
        else setFound(s)
      })
      .catch((e) => !cancelled && setError(toAppError(e).code))
      .finally(() => !cancelled && setChecking(false))
    return () => {
      cancelled = true
    }
  }, [pin])

  async function join(e: FormEvent) {
    e.preventDefault()
    const nick = nickname.trim()
    if (!pin || !nick) return
    setJoining(true)
    setError(null)
    try {
      await ensurePlayerIdentity()
      const player = await joinSession(pin, nick, avatar)
      safeStorage.set(NICK_KEY, nick)
      if (customAvatar) safeStorage.set(AVATAR_KEY, JSON.stringify(serializeAvatar(customAvatar)))
      else safeStorage.remove(AVATAR_KEY)
      navigate(`/play/${player.session_id}`, { replace: true })
    } catch (err) {
      setError(toAppError(err).code)
      setJoining(false)
    }
  }

  function resetPin() {
    setPin(null)
    setFound(null)
    setError(null)
    navigate('/join', { replace: true })
  }

  const errorText = error ? t(`errors.${error}`) : null

  return (
    <div className="flex min-h-dvh flex-col bg-stage px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-6 text-stage-fg">
      <header className="flex items-center justify-between">
        <Link to="/" aria-label="Tilt">
          <Logo className="text-3xl text-paper" />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-8">
        {!found ? (
          <>
            <h1 className="text-4xl font-extrabold">{t('player.joinTitle')}</h1>
            {checking ? (
              <div className="grid place-items-center py-10 text-lime">
                <Spinner className="size-10" label={t('common.loading')} />
              </div>
            ) : (
              <PinForm
                key={pin ?? 'empty'}
                tone="stage"
                autoFocus
                defaultValue={pin ?? ''}
                error={errorText}
                onSubmit={(p) => {
                  setError(null)
                  setChecking(true)
                  setPin(p)
                }}
              />
            )}
          </>
        ) : (
          <form onSubmit={join} className="flex animate-fade-up flex-col gap-6" noValidate>
            <div>
              <p className="text-sm font-semibold text-paper/60">{found.quiz_title}</p>
              <h1 className="mt-1 text-4xl font-extrabold">{t('player.nicknameTitle')}</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Avatar proposed from the nickname: no extra step to join. */}
              <div
                role="img"
                aria-label={t('avatar.of', { name: nickname.trim() || '?' })}
                className={cn(
                  'grid shrink-0 -rotate-3 place-items-center rounded-md border-[3px] border-black bg-paper shadow-[4px_4px_0_0_#000] transition-[width,height] duration-200 ease-out',
                  editing ? 'size-24' : 'size-20',
                )}
              >
                <AvatarPreview config={avatar} size={editing ? 80 : 66} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor="nickname" className="sr-only">
                  {t('player.nicknameLabel')}
                </label>
                <input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={24}
                  autoFocus
                  autoComplete="nickname"
                  enterKeyHint="go"
                  placeholder={t('player.nicknamePlaceholder')}
                  aria-invalid={error === 'NICKNAME_TAKEN' || error === 'NICKNAME_INVALID' || undefined}
                  className={cn(
                    'h-14 w-full rounded-md border-[3px] border-black bg-paper px-4 font-display text-2xl font-bold text-ink placeholder:text-ink/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-lime',
                    error && 'animate-wiggle',
                  )}
                />
                <p className="text-xs text-paper/60">{t('player.nicknameHint')}</p>
              </div>
            </div>
            {/* Default: two light actions; the main CTA stays "Let's go". */}
            {!editing && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCustomAvatar(randomAvatar())} className={secondaryAction}>
                  <Shuffle className="size-4 shrink-0" aria-hidden="true" />
                  {t('avatar.shuffle')}
                </button>
                <button ref={customizeButton} type="button" aria-expanded={editing} aria-controls="avatar-panel" onClick={openEditor} className={secondaryAction}>
                  <Palette className="size-4 shrink-0" aria-hidden="true" />
                  {t('avatar.customize')}
                </button>
              </div>
            )}
            {/* Customization panel: opens in place (no extra screen), collapses fully when done. */}
            <div
              id="avatar-panel"
              inert={!editing}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                editing ? 'grid-rows-[1fr] opacity-100' : '-mt-6 grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="min-h-0 overflow-hidden pr-1.5 pb-1.5">
                <section aria-labelledby="avatar-panel-title" ref={panelRef} className="rounded-lg border-[3px] border-black bg-ink-soft p-3 shadow-[5px_5px_0_0_#000]">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 id="avatar-panel-title" className="font-display text-lg font-bold">
                      {t('avatar.customizeTitle')}
                    </h2>
                    <button
                      type="button"
                      onClick={closeEditor}
                      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border-2 border-lime px-3 text-sm font-bold text-lime transition-colors duration-150 hover:bg-lime hover:text-ink"
                    >
                      <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                      {t('avatar.done')}
                    </button>
                  </div>
                  <AvatarEditor
                    tone="stage"
                    showPreview={false}
                    value={avatar}
                    onChange={(c) => setCustomAvatar(c === autoAvatar ? null : c)}
                    resetTo={autoAvatar}
                  />
                </section>
              </div>
            </div>
            {errorText && (
              <p role="alert" className="rounded-md bg-amber px-3 py-2 text-sm font-semibold text-ink">
                {errorText}
              </p>
            )}
            <Button type="submit" size="xl" variant="paper" loading={joining} disabled={!nickname.trim()} iconRight={<ArrowRight className="size-6" />}>
              {joining ? t('player.joining') : t('player.joinAction')}
            </Button>
            <button type="button" onClick={resetPin} className="inline-flex items-center gap-1.5 self-center text-sm font-semibold text-paper/60 hover:text-paper">
              <ArrowLeft className="size-4" /> {t('player.changePin')}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}

