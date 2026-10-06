import { DesktopLayout } from './DesktopLayout.tsx'
import { HomePage } from './HomePage.tsx'
import { MobileLayout } from './MobileLayout.tsx'
import { useIsDesktop } from './useIsDesktop.ts'

/** Uma casca para cada tamanho de tela; as features dentro delas são as mesmas. */
export function App() {
  const Layout = useIsDesktop() ? DesktopLayout : MobileLayout
  return (
    <Layout>
      <HomePage />
    </Layout>
  )
}
