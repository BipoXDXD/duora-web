import type { Page, Request } from '@playwright/test'

/** O nome do cookie e do header de CSRF que o cliente HTTP do app usa (src/shared/api/http.ts). */
export const CSRF_COOKIE = 'XSRF-TOKEN'
export const CSRF_HEADER = 'x-xsrf-token'
export const CSRF_TOKEN = 'e2e-csrf-token'

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD'])
const BAD_REQUEST = 400
const FORBIDDEN = 403
const UNMOCKED = 599

export interface ApiRequest {
  readonly method: string
  readonly path: string
  readonly query: URLSearchParams
  /** Os nomes dos headers chegam em minúsculas. */
  readonly headers: Readonly<Record<string, string>>
  /** O corpo já lido como JSON, ou `null` sem corpo. */
  readonly body: unknown
}

export interface ApiAnswer {
  readonly status: number
  readonly body?: unknown
  readonly headers?: Readonly<Record<string, string>>
}

/** Uma resposta pronta, ou uma função que a decide pelo pedido; a função pode esperar (uma `Promise`). */
export type ApiHandler = ApiAnswer | ((request: ApiRequest) => ApiAnswer | Promise<ApiAnswer>)

export function json(status: number, body: unknown, headers: Readonly<Record<string, string>> = {}): ApiAnswer {
  return { status, body, headers }
}

/** Um 4xx/5xx como a API manda: `application/problem+json`, com o `reason` das recusas por regra. */
export function problem(
  status: number,
  extra: Readonly<Record<string, unknown>> = {},
  headers: Readonly<Record<string, string>> = {},
): ApiAnswer {
  return {
    status,
    body: { title: 'Erro', status, ...extra },
    headers: { 'content-type': 'application/problem+json', ...headers },
  }
}

export const noContent: ApiAnswer = { status: 204 }

/** Uma resposta que o teste libera quando quiser, para ver o estado "enviando" antes do fim. */
export function gate(): { readonly answer: Promise<ApiAnswer>; readonly release: (answer: ApiAnswer) => void } {
  const { promise, resolve } = Promise.withResolvers<ApiAnswer>()
  return { answer: promise, release: resolve }
}

/**
 * A duora-api no navegador. Cada jornada declara só as rotas de que precisa; uma rota sem resposta falha o
 * teste (o `fakeApi` do fixture confere), em vez de cair no `index.html` do SPA fallback do `vite preview`.
 * Toda mutação tem de levar o token CSRF do cookie, como a API exige: sem ele a resposta é 403 e o teste falha.
 */
export class FakeApi {
  private readonly handlers = new Map<string, ApiHandler>()
  private readonly recorded: ApiRequest[] = []
  /** Pedidos sem resposta declarada ou sem CSRF; o fixture exige que esta lista termine vazia. */
  readonly problems: string[] = []

  /** Declara (ou troca) a resposta de um método e caminho. */
  on(method: string, path: string, handler: ApiHandler): this {
    this.handlers.set(keyOf(method, path), handler)
    return this
  }

  /** Os pedidos que chegaram a `method` e `path`, em ordem. */
  callsTo(method: string, path: string): readonly ApiRequest[] {
    return this.recorded.filter((call) => call.method === method && call.path === path)
  }

  /** Para o teste afirmar que algo NÃO foi chamado. */
  hasCalled(method: string, path: string): boolean {
    return this.callsTo(method, path).length > 0
  }

  async install(page: Page): Promise<void> {
    await page.route(
      (url) => url.pathname.startsWith('/api/'),
      async (route) => {
        const request = await readRequest(route.request())
        this.recorded.push(request)
        const answer = await this.answerTo(request)
        await route.fulfill({
          status: answer.status,
          headers: { 'content-type': 'application/json', ...answer.headers },
          body: answer.body === undefined ? '' : JSON.stringify(answer.body),
        })
      },
    )
  }

  private async answerTo(request: ApiRequest): Promise<ApiAnswer> {
    const label = `${request.method} ${request.path}`
    if (!SAFE_METHODS.has(request.method) && request.headers[CSRF_HEADER] !== CSRF_TOKEN) {
      this.problems.push(`sem token CSRF: ${label}`)
      return problem(FORBIDDEN)
    }
    const handler = this.handlers.get(keyOf(request.method, request.path))
    if (handler === undefined) {
      this.problems.push(`sem resposta declarada: ${label}`)
      return problem(UNMOCKED)
    }
    try {
      return typeof handler === 'function' ? await handler(request) : handler
    } catch (error) {
      // Corpo que não bate com o contrato: o front mandou algo que a API recusaria.
      this.problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
      return problem(BAD_REQUEST)
    }
  }
}

function keyOf(method: string, path: string): string {
  return `${method} ${path}`
}

async function readRequest(request: Request): Promise<ApiRequest> {
  const url = new URL(request.url())
  const text = request.postData()
  return {
    method: request.method(),
    path: url.pathname,
    query: url.searchParams,
    headers: request.headers(),
    body: text === null ? null : JSON.parse(text),
  }
}
