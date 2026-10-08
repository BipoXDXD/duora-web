import { z } from 'zod/mini'
import { ApiError, isApiFailure, readJsonBody, sendApiRequest } from '../../shared/api/http.ts'
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

/**
 * O 403 junta perfil incompleto, menor de 18 e token CSRF ausente; o cliente HTTP sempre manda o token,
 * então para a tela ele é o perfil. O 409 junta lotado, cancelado e começado, sem dizer qual.
 */
export type RegisterResult =
  | { readonly kind: 'registered'; readonly registration: Registration }
  | { readonly kind: 'profileIncomplete' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'busy'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

export type CancelResult =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'alreadyStarted' }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

const UNAUTHORIZED = 401
const FORBIDDEN = 403
const NOT_FOUND = 404
const CONFLICT = 409
const SERVICE_UNAVAILABLE = 503

function registrationPath(eventId: string): string {
  return `/api/events/${encodeURIComponent(eventId)}/registration`
}

/** A própria inscrição no evento, ou `null` sem inscrição (a API responde 404 igual se o evento não existe). */
export async function fetchRegistration(eventId: string): Promise<Registration | null> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: registrationPath(eventId) })
    return await readJsonBody(response, registrationSchema)
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND) {
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
      return { kind: 'profileIncomplete' }
    case NOT_FOUND:
      return { kind: 'notFound' }
    case CONFLICT:
      return { kind: 'unavailable' }
    case SERVICE_UNAVAILABLE:
      return { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
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
      return { kind: 'alreadyStarted' }
    default:
      return { kind: 'failed' }
  }
}

/** Uma página das próprias inscrições em eventos que não acabaram, inclusive cancelados e em andamento. */
export async function fetchMyRegistrationsPage(pageToken: string | null): Promise<MyRegistrationsPage> {
  const response = await sendApiRequest({ method: 'GET', path: `/api/me/registrations${pageQuery(pageToken)}` })
  return readJsonBody(response, myRegistrationsPageSchema)
}
