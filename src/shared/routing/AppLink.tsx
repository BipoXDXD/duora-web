import type { MouseEvent, ReactNode } from 'react'
import { goTo } from './history.ts'

interface AppLinkProps {
  readonly to: string
  readonly className: string
  readonly children: ReactNode
  readonly 'aria-current'?: 'page'
}

const MAIN_BUTTON = 0

/**
 * Link para uma página do app. É um `<a>` de verdade: abre em nova aba e funciona sem JavaScript. Só o
 * clique simples troca a página sem recarregar; com modificador ou botão do meio, o navegador decide.
 */
export function AppLink({ to, className, children, 'aria-current': ariaCurrent }: AppLinkProps) {
  function followInApp(event: MouseEvent<HTMLAnchorElement>) {
    if (isPlainClick(event)) {
      event.preventDefault()
      goTo(to)
    }
  }

  return (
    <a href={to} onClick={followInApp} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  )
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  const hasModifier = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
  return event.button === MAIN_BUTTON && !hasModifier
}
