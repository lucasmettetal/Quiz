/**
 * External images a quiz may reference: only Kahoot's image CDN (imports).
 * Same rule as public.is_allowed_media_path() in SQL. Anything else would make
 * every player's browser call a host chosen by the quiz author.
 */
export function isAllowedExternalMedia(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (u.hostname === 'kahoot.it' || u.hostname.endsWith('.kahoot.it'))
  } catch {
    return false
  }
}
