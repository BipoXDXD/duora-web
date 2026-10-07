import { useSyncExternalStore } from 'react'

/** O `pushState` não dispara `popstate`; este evento avisa quem lê o caminho que ele mudou. */
const PATH_CHANGE = 'duora:pathchange'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(PATH_CHANGE, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(PATH_CHANGE, onChange)
  }
}

function currentPathname(): string {
  return window.location.pathname
}

/** O caminho da página atual, atualizado nos links do app e nos botões voltar e avançar do navegador. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPathname)
}

/** Troca de página dentro do app, sem recarregar: a sessão e os dados em cache continuam. */
export function goTo(path: string): void {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(PATH_CHANGE))
}
