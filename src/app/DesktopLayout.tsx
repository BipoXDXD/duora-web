import type { ReactNode } from 'react'
import { LOGIN_URL } from '../features/auth/loginUrl.ts'

interface DesktopLayoutProps {
  children: ReactNode
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-divider bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          <a href="/" className="rounded text-xl font-semibold tracking-tight text-fg-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
            Duora
          </a>
          <nav aria-label="Principal" className="flex items-center gap-6">
            <a href="/" aria-current="page" className="rounded text-fg-muted hover:text-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus">
              Início
            </a>
            <a
              href={LOGIN_URL}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-on-primary shadow-raised hover:bg-primary-hover focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Entrar
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-8 py-16">{children}</main>
    </div>
  )
}
