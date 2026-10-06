import { vi } from 'vitest'

/** Resposta de uma rota da API no teste. Pode não resolver nunca, para manter a tela carregando. */
export type FakeRoute = () => Promise<Response>

/**
 * Troca o `fetch` global por um dublê que responde por caminho. Caminho sem rota rejeita com um erro
 * comum (não de rede), para um teste mal montado falhar alto em vez de virar "API fora do ar".
 */
export function stubApi(routes: Readonly<Record<string, FakeRoute>>) {
  const fetchMock = vi.fn<typeof fetch>((input) => {
    const path = String(input)
    const route = routes[path]
    return route === undefined ? Promise.reject(new Error(`rota sem resposta no teste: ${path}`)) : route()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function jsonAnswer(body: unknown, status = 200): FakeRoute {
  return () =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

export function statusAnswer(status: number): FakeRoute {
  return () => Promise.resolve(new Response(null, { status }))
}

export function networkFailure(): FakeRoute {
  return () => Promise.reject(new TypeError('Failed to fetch'))
}

export function neverAnswer(): FakeRoute {
  return () => new Promise<Response>(() => undefined)
}

/** Visitante sem sessão: o estado inicial da landing. */
export const ANONYMOUS_SESSION = { '/api/me': statusAnswer(401) } as const
