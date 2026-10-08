import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { BlockedAccountsPage } from '../features/blocks/BlockedAccountsPage.tsx'
import { EventPage } from '../features/events/EventPage.tsx'
import { EventsPage } from '../features/events/EventsPage.tsx'
import { MyRegistrationsPage } from '../features/events/MyRegistrationsPage.tsx'
import { ProfilePage } from '../features/profile/ProfilePage.tsx'
import { usePathname } from '../shared/routing/history.ts'
import { routeOf, type Route } from '../shared/routing/routes.ts'
import { DesktopLayout } from './DesktopLayout.tsx'
import { HomePage } from './HomePage.tsx'
import { MobileLayout } from './MobileLayout.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'
import { useIsDesktop } from './useIsDesktop.ts'

/** Raiz do app: um cache de dados remotos por montagem, para cada teste começar do zero. */
export function App() {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  )
}

/** Uma casca para cada tamanho de tela; as páginas dentro delas são as mesmas. */
function Shell() {
  const Layout = useIsDesktop() ? DesktopLayout : MobileLayout
  const route = routeOf(usePathname())
  return (
    <Layout route={route}>
      <Page route={route} />
    </Layout>
  )
}

function Page({ route }: { readonly route: Route }) {
  switch (route.page) {
    case 'home':
      return <HomePage />
    case 'profile':
      return <ProfilePage />
    case 'blockedAccounts':
      return <BlockedAccountsPage />
    case 'events':
      return <EventsPage />
    case 'event':
      return <EventPage eventId={route.eventId} />
    case 'registrations':
      return <MyRegistrationsPage />
    case 'notFound':
      return <NotFoundPage />
  }
}
