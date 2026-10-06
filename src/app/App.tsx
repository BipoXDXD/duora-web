import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { DesktopLayout } from './DesktopLayout.tsx'
import { HomePage } from './HomePage.tsx'
import { MobileLayout } from './MobileLayout.tsx'
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

/** Uma casca para cada tamanho de tela; as features dentro delas são as mesmas. */
function Shell() {
  const Layout = useIsDesktop() ? DesktopLayout : MobileLayout
  return (
    <Layout>
      <HomePage />
    </Layout>
  )
}
