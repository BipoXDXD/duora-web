import { vi } from 'vitest'

/**
 * Resposta de uma rota da API no teste, que pode olhar a requisição (método, corpo). Pode não resolver
 * nunca, para manter a tela carregando.
 */
export type FakeRoute = (init?: RequestInit) => Promise<Response>

/**
 * Troca o `fetch` global por um dublê que responde por caminho. Caminho sem rota rejeita com um erro
 * comum (não de rede), para um teste mal montado falhar alto em vez de virar "API fora do ar".
 */
export function stubApi(routes: Readonly<Record<string, FakeRoute>>) {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const path = String(input)
    const route = routes[path]
    return route === undefined ? Promise.reject(new Error(`rota sem resposta no teste: ${path}`)) : route(init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function jsonAnswer(body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}): FakeRoute {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } }),
    )
}

/**
 * Erro no formato ProblemDetail (RFC 9457), como a duora-api responde. `errors` é o membro dos 400 de
 * validação de corpo (`ValidationProblemDetail`).
 */
export function problemAnswer(status: number, detail?: string, errors?: unknown): FakeRoute {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify({ title: 'Erro', status, detail, errors }), {
        status,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )
}

/** Recusa por regra de negócio (403 ou 409), com o `reason` que a API manda (ADR 0020 da duora-api). */
export function refusalAnswer(status: number, reason: string): FakeRoute {
  return () =>
    Promise.resolve(
      new Response(JSON.stringify({ title: 'Erro', status, reason }), {
        status,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    )
}

/** Uma resposta por método no mesmo caminho, como GET e PATCH do perfil. Método sem resposta falha alto. */
export function byMethod(answers: Readonly<Partial<Record<string, FakeRoute>>>): FakeRoute {
  return (init) => {
    const method = init?.method ?? 'GET'
    const answer = answers[method]
    return answer === undefined ? Promise.reject(new Error(`método sem resposta no teste: ${method}`)) : answer(init)
  }
}

/** Respostas em ordem, uma por chamada; a última se repete. */
export function inSequence(first: FakeRoute, ...rest: readonly FakeRoute[]): FakeRoute {
  const answers = [first, ...rest]
  let call = 0
  return (init) => {
    const answer = answers[Math.min(call, answers.length - 1)] ?? first
    call += 1
    return answer(init)
  }
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
