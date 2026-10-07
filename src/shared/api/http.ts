import { z } from 'zod/mini'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequest {
  readonly method: HttpMethod
  /** Caminho na mesma origem, como `/api/waitlist`: a sessão vai no cookie, nunca para outro site. */
  readonly path: string
  readonly body?: unknown
  /** O ETag da última leitura, para a API recusar com 412 uma edição sobre versão desatualizada. */
  readonly ifMatch?: string
}

/**
 * Resposta fora de 2xx. `retryAfterSeconds` é `null` quando a API não disse quando tentar de novo.
 * `problemDetail` é o `detail` do ProblemDetail (RFC 9457), em inglês e para o desenvolvedor: nunca vai
 * direto para a tela. `null` quando o corpo não o trouxe.
 */
export class ApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null
  readonly problemDetail: string | null

  constructor(status: number, retryAfterSeconds: number | null, problemDetail: string | null = null) {
    super(`A API respondeu ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.problemDetail = problemDetail
  }
}

/** A requisição não chegou à API: o `fetch` rejeitou (rede fora do ar, DNS, conexão recusada). */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super('Não foi possível falar com a API', options)
    this.name = 'NetworkError'
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
 * XSRF-TOKEN (docs/adr/0002 da duora-api). Falha de rede vira NetworkError.
 */
export async function sendApiRequest(request: ApiRequest): Promise<Response> {
  const response = await fetchOrNetworkError(request.path, {
    method: request.method,
    headers: headersFor(request),
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'))
    throw new ApiError(response.status, retryAfterSeconds, await readProblemDetail(response))
  }
  return response
}

/**
 * O `fetch` rejeita com TypeError quando a rede falha. Só essa rejeição vira NetworkError, aqui e em
 * nenhum outro lugar: um TypeError do nosso código continua sendo bug e propaga como está.
 */
async function fetchOrNetworkError(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init)
  } catch (error) {
    if (error instanceof TypeError) {
      throw new NetworkError({ cause: error })
    }
    throw error
  }
}

function headersFor(request: ApiRequest): Headers {
  const headers = new Headers()
  if (request.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (request.ifMatch !== undefined) {
    headers.set('If-Match', request.ifMatch)
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

const problemDetailSchema = z.object({ detail: z.optional(z.string()) })

/**
 * O corpo de erro é informação extra: sem ele, ou fora do formato, o erro continua sendo o status. Por
 * isso aqui corpo inválido vira `null`, e não InvalidResponseError.
 */
async function readProblemDetail(response: Response): Promise<string | null> {
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }
    throw error
  }
  const parsed = problemDetailSchema.safeParse(body)
  return parsed.success ? (parsed.data.detail ?? null) : null
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
    // SyntaxError é corpo que não é JSON (inclusive vazio). Outro erro, como ler o corpo duas vezes, é bug.
    if (error instanceof SyntaxError) {
      throw new InvalidResponseError({ cause: error })
    }
    throw error
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new InvalidResponseError({ cause: parsed.error })
  }
  return parsed.data
}

/**
 * Falhas esperadas de uma chamada: status fora de 2xx, rede fora do ar ou corpo fora do contrato. Qualquer outra coisa é defeito e não deve virar mensagem.
 */
export function isApiFailure(error: unknown): boolean {
  return error instanceof ApiError || error instanceof NetworkError || error instanceof InvalidResponseError
}

/** Para o `throwOnError` do TanStack Query: falha esperada vira estado na tela; bug sobe para o React. */
export function isBug(error: Error): boolean {
  return !isApiFailure(error)
}
