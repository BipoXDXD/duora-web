import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../app/App.tsx'
import { stubApi, type FakeRoute } from './fakeApi.ts'
import { stubMatchMedia } from './fakeMatchMedia.ts'

interface Viewport {
  /** Verdadeiro para o layout largo (a navegação do desktop); o padrão é o do celular. */
  readonly isDesktop?: boolean
}

/**
 * Abre o app inteiro numa rota, com a API simulada pelos caminhos de `routes` e a largura de tela escolhida.
 * Devolve o `fetch` simulado, para conferir as chamadas, e o `user` que age sobre a tela.
 */
export function renderAppAt(
  path: string,
  routes: Readonly<Record<string, FakeRoute>>,
  { isDesktop = false }: Viewport = {},
) {
  stubMatchMedia(isDesktop)
  window.history.replaceState(null, '', path)
  const fetchMock = stubApi(routes)
  render(<App />)
  return { fetchMock, user: userEvent.setup() }
}
