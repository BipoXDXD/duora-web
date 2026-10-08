import type { ReactNode } from 'react'
import { HeaderGreeting, MemberLink, SessionTab } from '../features/auth/SessionControls.tsx'
import { Logo } from '../shared/brand/Logo.tsx'
import { AppLink } from '../shared/routing/AppLink.tsx'
import { isEventsRoute, isProfileRoute, PATHS, type Route } from '../shared/routing/routes.ts'
import { ThemeToggle } from './theme/ThemeToggle.tsx'

interface MobileLayoutProps {
  readonly route: Route
  readonly children: ReactNode
}

const TAB_CLASS =
  'flex min-h-11 min-w-11 flex-auto items-center justify-center rounded-lg px-1 text-sm font-semibold aria-[current=page]:text-fg-accent'

export function MobileLayout({ route, children }: MobileLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider bg-canvas px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between gap-3">
          <AppLink to={PATHS.home} className="group inline-flex min-h-11 min-w-11 items-center rounded-lg text-fg">
            <Logo className="h-7 w-auto" />
          </AppLink>
          <HeaderGreeting />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <nav
        aria-label="Atalhos"
        className="sticky bottom-0 z-10 flex gap-1 border-t border-divider bg-surface px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <AppLink to={PATHS.home} className={TAB_CLASS} aria-current={route.page === 'home' ? 'page' : undefined}>
          Início
        </AppLink>
        <MemberLink to={PATHS.events} label="Eventos" className={TAB_CLASS} isCurrent={isEventsRoute(route)} />
        <MemberLink
          to={PATHS.connections}
          label="Conexões"
          className={TAB_CLASS}
          isCurrent={route.page === 'connections'}
        />
        <MemberLink to={PATHS.profile} label="Perfil" className={TAB_CLASS} isCurrent={isProfileRoute(route)} />
        <SessionTab tabClassName={TAB_CLASS} />
      </nav>
    </div>
  )
}
