import { useCallback, useState, useSyncExternalStore } from 'react'
import { applyTheme, PREFERS_DARK_QUERY, readStoredTheme, storeTheme, type ThemeChoice } from './themePreference.ts'

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(PREFERS_DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function systemTheme(): ThemeChoice {
  return window.matchMedia(PREFERS_DARK_QUERY).matches ? 'dark' : 'light'
}

/** O tema em vigor (escolhido ou do sistema) e a troca para o outro, que fica lembrada. */
export function useThemeChoice(): { readonly theme: ThemeChoice; readonly switchTheme: () => void } {
  const [choice, setChoice] = useState(readStoredTheme)
  const system = useSyncExternalStore(subscribe, systemTheme)
  const theme = choice ?? system

  const switchTheme = useCallback(() => {
    const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark'
    setChoice(next)
    applyTheme(next)
    storeTheme(next)
  }, [theme])

  return { theme, switchTheme }
}
