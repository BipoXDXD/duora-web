import type { ReactNode } from 'react'
import { LOGIN_URL } from '../features/auth/loginUrl.ts'

interface MobileLayoutProps {
  children: ReactNode
}

const TAB_CLASS =
  'flex min-h-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus'

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider bg-surface px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex h-12 items-center">
          <a href="/" className="rounded text-lg font-semibold tracking-tight text-fg-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Duora
          </a>
        </div>
      </header>
      <main className="flex-1 px-4 py-8">{children}</main>
      <nav
        aria-label="Atalhos"
        className="sticky bottom-0 flex gap-2 border-t border-divider bg-surface px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <a href="/" aria-current="page" className={`${TAB_CLASS} text-fg-accent`}>
          Início
        </a>
        <a href={LOGIN_URL} className={`${TAB_CLASS} bg-primary text-on-primary`}>
          Entrar
        </a>
      </nav>
    </div>
  )
}
