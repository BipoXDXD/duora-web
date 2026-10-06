import type { z } from 'zod/mini'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequest {
  readonly method: HttpMethod
  /** Caminho na mesma origem, como `/api/waitlist`: a sessão vai no cookie, nunca para outro site. */
  readonly path: string
  readonly body?: unknown
}

/** Resposta fora de 2xx. `retryAfterSeconds` é `null` quando a API não disse quando tentar de novo. */
export class ApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null

  constructor(status: number, retryAfterSeconds: number | null) {
    super(`A API respondeu ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Resposta 2xx cujo corpo não segue o contrato: não é JSON ou não tem a forma combinada com a API. */
export class InvalidResponseError extends Error {
  constructor(options?: ErrorOptions) {
    super('A resposta da API não segue o contrato', options)
    this.name = 'InvalidResponseError'
  }
}

const CSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_HEADER = 'X-XSRF-TOKEN'
const SAFE_METHODS: ReadonlySet<HttpMethod> = new Set(['GET'])

/**
 * Único ponto de saída para a API. Mutações levam o token CSRF que o Spring deixa no cookie
 * XSRF-TOKEN (docs/adr/0002 da duora-api). Falha de rede propaga a rejeição do `fetch`.
 */
export async function sendApiRequest(request: ApiRequest): Promise<Response> {
  const response = await fetch(request.path, {
    method: request.method,
    headers: headersFor(request),
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new ApiError(response.status, parseRetryAfterSeconds(response.headers.get('Retry-After')))
  }
  return response
}

function headersFor(request: ApiRequest): Headers {
  const headers = new Headers()
  if (request.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const csrfToken = SAFE_METHODS.has(request.method) ? null : readCookie(CSRF_COOKIE)
  if (csrfToken !== null) {
    headers.set(CSRF_HEADER, csrfToken)
  }
  return headers
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix))
  return cookie === undefined ? null : decodeURIComponent(cookie.slice(prefix.length))
}

/** A duora-api manda Retry-After em segundos; a forma de data HTTP não é usada por ela. */
function parseRetryAfterSeconds(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header)) {
    return null
  }
  return Number(header)
}

/**
 * Lê o corpo JSON e o converte pelo schema, a única porta de dado da API para dentro do app. Campos
 * que o schema não declara são descartados (tolerant reader).
 */
export async function readJsonBody<T>(response: Response, schema: z.ZodMiniType<T>): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new InvalidResponseError({ cause: error })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new InvalidResponseError({ cause: parsed.error })
  }
  return parsed.data
}

/**
 * Falhas esperadas de uma chamada: status fora de 2xx, rede fora do ar (o `fetch` rejeita com
 * TypeError) ou corpo fora do contrato. Qualquer outra coisa é defeito e não deve virar mensagem.
 */
export function isApiFailure(error: unknown): boolean {
  return error instanceof ApiError || error instanceof TypeError || error instanceof InvalidResponseError
}
