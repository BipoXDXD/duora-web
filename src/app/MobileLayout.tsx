import type { ReactNode } from 'react'
import { LOGIN_URL } from '../features/auth/loginUrl.ts'
import { Logo } from '../shared/brand/Logo.tsx'
import { ThemeToggle } from './theme/ThemeToggle.tsx'

interface MobileLayoutProps {
  children: ReactNode
}

const TAB_CLASS = 'flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-lg text-sm font-semibold'

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider bg-canvas px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between">
          <a href="/" className="group inline-flex min-h-11 min-w-11 items-center rounded-lg text-fg">
            <Logo className="h-7 w-auto" />
          </a>
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <nav
        aria-label="Atalhos"
        className="sticky bottom-0 z-10 flex gap-2 border-t border-divider bg-surface px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <a href="/" aria-current="page" className={`${TAB_CLASS} text-fg-accent`}>
          Início
        </a>
        <a href={LOGIN_URL} className={`${TAB_CLASS} border border-edge text-fg`}>
          Entrar
        </a>
      </nav>
    </div>
  )
}
