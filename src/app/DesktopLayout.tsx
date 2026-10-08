import type { ReactNode } from 'react'
import { HeaderSessionControls, MemberLink } from '../features/auth/SessionControls.tsx'
import { FAQ_ANCHOR } from '../features/landing/FaqSection.tsx'
import { HOW_IT_WORKS_ANCHOR } from '../features/landing/HowItWorksSection.tsx'
import { SAFETY_ANCHOR } from '../features/landing/SafetySection.tsx'
import { Logo } from '../shared/brand/Logo.tsx'
import { AppLink } from '../shared/routing/AppLink.tsx'
import { isEventsRoute, isProfileRoute, PATHS, type Route } from '../shared/routing/routes.ts'
import { ThemeToggle } from './theme/ThemeToggle.tsx'

interface DesktopLayoutProps {
  readonly route: Route
  readonly children: ReactNode
}

/** Seções da landing, com o caminho inteiro para também funcionarem a partir das outras páginas. */
const SECTION_LINKS = [
  { href: `/#${HOW_IT_WORKS_ANCHOR}`, label: 'Como funciona' },
  { href: `/#${SAFETY_ANCHOR}`, label: 'Segurança' },
  { href: `/#${FAQ_ANCHOR}`, label: 'Perguntas' },
] as const

const NAV_LINK_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-muted hover:text-fg aria-[current=page]:text-fg-accent'

export function DesktopLayout({ route, children }: DesktopLayoutProps) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-divider bg-canvas">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-8">
          <AppLink to={PATHS.home} className="group inline-flex min-h-11 min-w-11 items-center rounded-lg text-fg">
            <Logo className="h-8 w-auto" />
          </AppLink>
          <div className="flex items-center gap-6">
            <nav aria-label="Principal" className="flex items-center gap-6">
              {SECTION_LINKS.map((link) => (
                <a key={link.href} href={link.href} className={NAV_LINK_CLASS}>
                  {link.label}
                </a>
              ))}
              <MemberLink
                to={PATHS.events}
                label="Eventos"
                className={NAV_LINK_CLASS}
                isCurrent={isEventsRoute(route)}
              />
              <MemberLink
                to={PATHS.profile}
                label="Meu perfil"
                className={NAV_LINK_CLASS}
                isCurrent={isProfileRoute(route)}
              />
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
