import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Palette, Shuffle } from 'lucide-react'
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
import { AvatarEditor } from '@/features/avatars/AvatarEditor'
import { AvatarFace } from '@/features/avatars/AvatarFace'
import { useT } from '@/i18n/I18nProvider'

const NICK_KEY = 'tilt.nickname'
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
              <div className="grid size-20 shrink-0 -rotate-3 place-items-center rounded-md border-[3px] border-black bg-paper shadow-[4px_4px_0_0_#000]">
                <AvatarFace config={avatar} size={66} title={t('avatar.of', { name: nickname.trim() || '?' })} />
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
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button size="sm" variant="paper" icon={<Shuffle className="size-4" />} onClick={() => setCustomAvatar(randomAvatar())}>
                  {t('avatar.shuffle')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={editing}
                  className="text-paper/85 hover:bg-white/10 hover:text-paper"
                  icon={<Palette className="size-4" />}
                  onClick={() => setEditing((e) => !e)}
                >
                  {editing ? t('avatar.done') : t('avatar.customize')}
                </Button>
              </div>
              {editing && (
                <div className="animate-fade-up rounded-lg border-2 border-white/15 bg-white/5 p-3">
                  <AvatarEditor tone="stage" value={avatar} onChange={(c) => setCustomAvatar(c === autoAvatar ? null : c)} resetTo={autoAvatar} />
                </div>
              )}
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

