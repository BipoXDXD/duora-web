import type { ReactNode } from 'react'
import { LOGIN_URL } from '../features/auth/loginUrl.ts'

interface DesktopLayoutProps {
  children: ReactNode
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          <a href="/" className="rounded text-xl font-semibold tracking-tight text-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
            Duora
          </a>
          <nav aria-label="Principal" className="flex items-center gap-6">
            <a href="/" aria-current="page" className="rounded text-stone-700 hover:text-stone-900 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
              Início
            </a>
            <a
              href={LOGIN_URL}
              className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
