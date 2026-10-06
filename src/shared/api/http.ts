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
