import type { ReactNode } from 'react'
import { HeaderSessionControls } from '../features/auth/SessionControls.tsx'
import { FAQ_ANCHOR } from '../features/landing/FaqSection.tsx'
import { HOW_IT_WORKS_ANCHOR } from '../features/landing/HowItWorksSection.tsx'
import { SAFETY_ANCHOR } from '../features/landing/SafetySection.tsx'
import { Logo } from '../shared/brand/Logo.tsx'
import { ThemeToggle } from './theme/ThemeToggle.tsx'

interface DesktopLayoutProps {
  children: ReactNode
}

const SECTION_LINKS = [
  { href: `#${HOW_IT_WORKS_ANCHOR}`, label: 'Como funciona' },
  { href: `#${SAFETY_ANCHOR}`, label: 'Segurança' },
  { href: `#${FAQ_ANCHOR}`, label: 'Perguntas' },
] as const

export function DesktopLayout({ children }: DesktopLayoutProps) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-divider bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-8">
          <a href="/" className="group inline-flex min-h-11 min-w-11 items-center rounded-lg text-fg">
            <Logo className="h-8 w-auto" />
          </a>
          <div className="flex items-center gap-6">
            <nav aria-label="Principal" className="flex items-center gap-6">
              {SECTION_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <HeaderSessionControls />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
