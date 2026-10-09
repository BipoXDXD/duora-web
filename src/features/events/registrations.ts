import { z } from 'zod/mini'
import {
  ApiError,
  hasStatus,
  isApiFailure,
  readJsonBody,
  type RefusalReason,
  sendApiRequest,
} from '../../shared/api/http.ts'
import {
  CONFLICT,
  FORBIDDEN,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
} from '../../shared/api/httpStatus.ts'
import { EVENT_STATUSES, instantSchema, pageQuery } from './events.ts'

/** Corpo de PUT e GET /api/events/{id}/registration (RegistrationResponse). */
const registrationSchema = z.object({ eventId: z.uuid(), registeredAt: instantSchema })

/** Corpo de GET /api/me/registrations: a inscrição com o resumo do evento. */
const myRegistrationsPageSchema = z.object({
  items: z.array(
    z.object({
      eventId: z.uuid(),
      title: z.string(),
      startsAt: instantSchema,
      endsAt: instantSchema,
      eventStatus: z.enum(EVENT_STATUSES),
      registeredAt: instantSchema,
    }),
  ),
  nextPageToken: z.nullable(z.string()),
})

/** O que os schemas aceitam da API; o teste compara com os tipos gerados da spec. */
export type RegistrationWire = z.input<typeof registrationSchema>
export type MyRegistrationsPageWire = z.input<typeof myRegistrationsPageSchema>

export type Registration = Readonly<z.output<typeof registrationSchema>>
export type MyRegistrationsPage = Readonly<z.output<typeof myRegistrationsPageSchema>>
export type MyRegistration = Readonly<MyRegistrationsPage['items'][number]>

/** Por que o evento não aceita mais a ação: `lotou`, `foi cancelado`, `já começou` ou `já terminou`. */
export type EventClosure = 'full' | 'cancelled' | 'started' | 'ended'

/**
 * O que a API respondeu a uma inscrição. Os 403 e 409 de regra trazem o `reason` (ADR 0020 da duora-api); sem
 * ele, ou com um que o front não conhece, vale a recusa genérica do status: `notAllowed` (403) e `unavailable`
 * sem `cause` (409). `busy` junta o 503 (evento ocupado ou limite não contado) e o 429 (limite da conta).
 */
export type RegisterResult =
  | { readonly kind: 'registered'; readonly registration: Registration }
  | { readonly kind: 'profileIncomplete' }
  | { readonly kind: 'underage' }
  | { readonly kind: 'notAllowed' }
  | { readonly kind: 'unavailable'; readonly cause: EventClosure | null }
  | { readonly kind: 'busy'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

/** `tooLate` é o 409 do cancelamento: o evento já começou ou já terminou, e `cause` diz qual dos dois. */
export type CancelResult =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'tooLate'; readonly cause: 'started' | 'ended' | null }
  | { readonly kind: 'busy'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

const CLOSURE_BY_REASON: Readonly<Partial<Record<RefusalReason, EventClosure>>> = {
  EVENT_FULL: 'full',
  EVENT_CANCELLED: 'cancelled',
  EVENT_STARTED: 'started',
  EVENT_ENDED: 'ended',
}

/** O motivo do 409 em termos do evento, ou `null` quando a API não o disse ou disse um que não é de evento. */
function closureOf(error: ApiError): EventClosure | null {
  return error.refusalReason === null ? null : (CLOSURE_BY_REASON[error.refusalReason] ?? null)
}

function registrationPath(eventId: string): string {
  return `/api/events/${encodeURIComponent(eventId)}/registration`
}

/** A própria inscrição no evento, ou `null` sem inscrição (a API responde 404 igual se o evento não existe). */
export async function fetchRegistration(eventId: string): Promise<Registration | null> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: registrationPath(eventId) })
    return await readJsonBody(response, registrationSchema)
  } catch (error) {
    if (hasStatus(error, NOT_FOUND)) {
      return null
    }
    throw error
  }
}

/** Inscreve quem chama. Repetir é seguro: a API devolve a mesma inscrição. Falhas esperadas viram resultado. */
export async function register(eventId: string): Promise<RegisterResult> {
  try {
    const response = await sendApiRequest({ method: 'PUT', path: registrationPath(eventId) })
    return { kind: 'registered', registration: await readJsonBody(response, registrationSchema) }
  } catch (error) {
    if (error instanceof ApiError) {
      return registerResultOf(error)
    }
    if (isApiFailure(error)) {
      return { kind: 'failed' }
    }
    throw error
  }
}

function registerResultOf(error: ApiError): RegisterResult {
  switch (error.status) {
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case FORBIDDEN:
      return forbiddenResultOf(error)
    case NOT_FOUND:
      return { kind: 'notFound' }
    case CONFLICT:
      return { kind: 'unavailable', cause: closureOf(error) }
    case TOO_MANY_REQUESTS:
    case SERVICE_UNAVAILABLE:
      return { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
  }
}

/** No cancelamento só importa se o evento começou ou terminou; outro motivo vira a recusa genérica. */
function lateClosureOf(error: ApiError): 'started' | 'ended' | null {
  const closure = closureOf(error)
  return closure === 'started' || closure === 'ended' ? closure : null
}

/** O cliente HTTP sempre manda o token CSRF, então um 403 aqui é recusa de regra; sem `reason`, é a genérica. */
function forbiddenResultOf(error: ApiError): RegisterResult {
  switch (error.refusalReason) {
    case 'PROFILE_INCOMPLETE':
      return { kind: 'profileIncomplete' }
    case 'UNDERAGE':
      return { kind: 'underage' }
    default:
      return { kind: 'notAllowed' }
  }
}

/** Cancela a própria inscrição. Sem inscrição também dá certo (a API é idempotente). */
export async function cancelRegistration(eventId: string): Promise<CancelResult> {
  try {
    await sendApiRequest({ method: 'DELETE', path: registrationPath(eventId) })
    return { kind: 'cancelled' }
  } catch (error) {
    if (error instanceof ApiError) {
      return cancelResultOf(error)
    }
    if (isApiFailure(error)) {
      return { kind: 'failed' }
    }
    throw error
  }
}

function cancelResultOf(error: ApiError): CancelResult {
  switch (error.status) {
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case NOT_FOUND:
      return { kind: 'notFound' }
    case CONFLICT:
      return { kind: 'tooLate', cause: lateClosureOf(error) }
    case TOO_MANY_REQUESTS:
    case SERVICE_UNAVAILABLE:
      return { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
  }
}

/** Uma página das próprias inscrições em eventos que não acabaram, inclusive cancelados e em andamento. */
export async function fetchMyRegistrationsPage(pageToken: string | null): Promise<MyRegistrationsPage> {
  const response = await sendApiRequest({ method: 'GET', path: `/api/me/registrations${pageQuery(pageToken)}` })
  return readJsonBody(response, myRegistrationsPageSchema)
}
