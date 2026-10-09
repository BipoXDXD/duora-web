import { z } from 'zod/mini'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequest {
  readonly method: HttpMethod
  /** Caminho na mesma origem, como `/api/waitlist`: a sessão vai no cookie, nunca para outro site. */
  readonly path: string
  readonly body?: unknown
  /** O ETag da última leitura, para a API recusar com 412 uma edição sobre versão desatualizada. */
  readonly ifMatch?: string
  /** Gerada por quem envia e repetida em cada reenvio da mesma operação, para a API gravá-la uma vez só. */
  readonly idempotencyKey?: string
}

/** Os `code` que a spec da API declara para um campo recusado (`FieldError.code`); o teste confere com ela. */
export const FIELD_ERROR_CODES = [
  'REQUIRED',
  'TOO_SHORT',
  'TOO_LONG',
  'BELOW_MINIMUM',
  'ABOVE_MAXIMUM',
  'INVALID_FORMAT',
  'UNSUPPORTED_VALUE',
  'FORBIDDEN_CHARACTER',
  'SELF_REFERENCE',
  'UNKNOWN_FIELD',
  'MALFORMED_BODY',
] as const

export type KnownFieldErrorCode = (typeof FIELD_ERROR_CODES)[number]

/** A API pode acrescentar `code` à lista: o que este front não conhece chega como `UNRECOGNIZED`. */
export type FieldErrorCode = KnownFieldErrorCode | 'UNRECOGNIZED'

/**
 * Os `reason` que a spec declara para uma recusa por regra de negócio (`RefusalProblemDetail.reason`, ADR 0020
 * da duora-api); o teste confere com ela.
 */
export const REFUSAL_REASONS = [
  'EVENT_NOT_PUBLISHED',
  'EVENT_ALREADY_PUBLISHED',
  'EVENT_CANCELLED',
  'EVENT_STARTED',
  'EVENT_ENDED',
  'EVENT_FULL',
  'EVENT_NOT_UNDERWAY',
  'ROUND_OUT_OF_SEQUENCE',
  'PROFILE_INCOMPLETE',
  'UNDERAGE',
  'BIRTH_DATE_ALREADY_SET',
  'DECISION_ALREADY_MADE',
  'CHAT_CLOSED',
  'IDEMPOTENCY_KEY_REUSED',
] as const

export type KnownRefusalReason = (typeof REFUSAL_REASONS)[number]

/** A API pode ampliar a lista: o `reason` que este front não conhece chega como `UNRECOGNIZED`. */
export type RefusalReason = KnownRefusalReason | 'UNRECOGNIZED'

/** Um campo que a API recusou num 400. `field` é `null` quando o erro é do corpo inteiro. */
export interface FieldError {
  readonly field: string | null
  readonly code: FieldErrorCode
}

/** O que o ProblemDetail de um erro trouxe, já lido: o que não veio ou veio fora do formato fica vazio. */
export interface ProblemBody {
  readonly detail: string | null
  readonly fieldErrors: readonly FieldError[]
  readonly refusalReason: RefusalReason | null
}

const NO_PROBLEM_BODY: ProblemBody = { detail: null, fieldErrors: [], refusalReason: null }

/**
 * Resposta fora de 2xx. `retryAfterSeconds` é `null` quando a API não disse quando tentar de novo.
 * `problemDetail` é o `detail` do ProblemDetail (RFC 9457), em inglês e para o desenvolvedor: nunca vai
 * direto para a tela. `null` quando o corpo não o trouxe. `fieldErrors` é o membro `errors` dos 400 de
 * validação (ADR 0018 da duora-api): é o que diz qual campo errou e por quê. Vazio quando não veio.
 * `refusalReason` é o membro `reason` das recusas por regra de negócio, 403 e 409 (ADR 0020): é o que diz
 * qual regra recusou. `null` quando não veio, e então vale a recusa genérica do status.
 */
export class ApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null
  readonly problemDetail: string | null
  readonly fieldErrors: readonly FieldError[]
  readonly refusalReason: RefusalReason | null

  constructor(status: number, retryAfterSeconds: number | null, problem: ProblemBody = NO_PROBLEM_BODY) {
    super(`A API respondeu ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
    this.problemDetail = problem.detail
    this.fieldErrors = problem.fieldErrors
    this.refusalReason = problem.refusalReason
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
    throw new ApiError(response.status, retryAfterSeconds, await readProblemBody(response))
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
  if (request.idempotencyKey !== undefined) {
    headers.set('Idempotency-Key', request.idempotencyKey)
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

const detailSchema = z.object({ detail: z.optional(z.string()) })

const fieldErrorsSchema = z.object({
  errors: z.array(z.object({ field: z.optional(z.string()), code: z.string() })),
})

const refusalReasonSchema = z.object({ reason: z.string() })

/**
 * O corpo de erro é informação extra: sem ele, ou fora do formato, o erro continua sendo o status. Por
 * isso aqui corpo inválido vira vazio, e não InvalidResponseError. `detail`, `errors` e `reason` são lidos
 * cada um por si: um `errors` malformado não leva o `detail` junto.
 */
async function readProblemBody(response: Response): Promise<ProblemBody> {
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NO_PROBLEM_BODY
    }
    throw error
  }
  const detail = detailSchema.safeParse(body)
  const errors = fieldErrorsSchema.safeParse(body)
  const refusal = refusalReasonSchema.safeParse(body)
  return {
    detail: detail.success ? (detail.data.detail ?? null) : null,
    fieldErrors: errors.success ? errors.data.errors.map(fieldErrorOf) : [],
    refusalReason: refusal.success ? refusalReasonOf(refusal.data.reason) : null,
  }
}

function refusalReasonOf(reason: string): RefusalReason {
  return isKnownRefusalReason(reason) ? reason : 'UNRECOGNIZED'
}

function isKnownRefusalReason(reason: string): reason is KnownRefusalReason {
  const known: readonly string[] = REFUSAL_REASONS
  return known.includes(reason)
}

function fieldErrorOf(wire: { readonly field?: string | undefined; readonly code: string }): FieldError {
  return { field: wire.field ?? null, code: isKnownFieldErrorCode(wire.code) ? wire.code : 'UNRECOGNIZED' }
}

function isKnownFieldErrorCode(code: string): code is KnownFieldErrorCode {
  const known: readonly string[] = FIELD_ERROR_CODES
  return known.includes(code)
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
