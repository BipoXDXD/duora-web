import type { Mock } from 'vitest'

/** Resposta JSON da API, como o `fetch` a entrega. */
export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

/**
 * Erro no formato ProblemDetail (RFC 9457), como a duora-api responde. `members` são os membros além de `title`
 * e `status`: `detail`, `errors` (400 de validação) ou `reason` (recusa por regra de negócio, ADR 0020).
 */
export function problemResponse(
  status: number,
  members: Readonly<Record<string, unknown>> = {},
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify({ title: 'Erro', status, ...members }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })
}

/** O caminho e as opções da primeira chamada ao `fetch`; falha alto se ele não foi chamado. */
export function firstRequest(fetchMock: Mock<typeof fetch>): { path: unknown; init: RequestInit } {
  const call = fetchMock.mock.calls[0]
  if (call === undefined) {
    throw new Error('fetch não foi chamado')
  }
  return { path: call[0], init: call[1] ?? {} }
}
