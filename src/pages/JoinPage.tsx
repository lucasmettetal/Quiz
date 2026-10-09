import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
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
import { COLOR_CLASSES, PALETTE, colorFor, isPaletteColor, type PaletteColor } from '@/lib/palette'
import { useT } from '@/i18n/I18nProvider'

const NICK_KEY = 'tilt.nickname'
const COLOR_KEY = 'tilt.avatar'

export function JoinPage() {
  const { pin: pinParam } = useParams()
  const t = useT()
  const navigate = useNavigate()
  const [pin, setPin] = useState<string | null>(pinParam && /^\d{6}$/.test(pinParam) ? pinParam : null)
  const [found, setFound] = useState<FoundSession | null>(null)
  const [error, setError] = useState<AppErrorCode | null>(null)
  const [checking, setChecking] = useState(Boolean(pin))
  const [nickname, setNickname] = useState(() => safeStorage.get(NICK_KEY) ?? '')
  const [avatar, setAvatar] = useState<PaletteColor>(() => {
    const stored = safeStorage.get(COLOR_KEY)
    return isPaletteColor(stored) ? stored : colorFor(String(Math.random()))
  })
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
      safeStorage.set(COLOR_KEY, avatar)
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
            <div className="flex flex-col gap-2">
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
                  'h-16 w-full rounded-md border-[3px] px-4 font-display text-2xl font-bold focus:outline-none',
                  COLOR_CLASSES[avatar].bg,
                  COLOR_CLASSES[avatar].on,
                  'border-black placeholder:text-current placeholder:opacity-50 focus-visible:ring-4 focus-visible:ring-paper/60',
                  error && 'animate-wiggle',
                )}
              />
              <p className="text-xs text-paper/60">{t('player.nicknameHint')}</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t('player.avatarLabel')}</legend>
              <div className="flex gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={avatar === c}
                    aria-label={t(`colors.${c}`)}
                    onClick={() => setAvatar(c)}
                    className={cn(
                      'size-11 rounded-sm border-[3px] transition-transform duration-150',
                      COLOR_CLASSES[c].bg,
                      avatar === c ? '-rotate-6 border-paper' : 'border-black hover:-rotate-3',
                    )}
                  />
                ))}
              </div>
            </fieldset>
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

