import { useSyncExternalStore } from 'react'

/** Único breakpoint do app: o `md` do Tailwind (48rem = 768px). Abaixo dele, a interface de smartphone. */
const DESKTOP_MEDIA_QUERY = '(min-width: 48rem)'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(DESKTOP_MEDIA_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function isDesktopNow(): boolean {
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktopNow)
}
