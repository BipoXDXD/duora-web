import { z } from 'zod/mini'
import {
  ApiError,
  type FieldError,
  hasStatus,
  isApiFailure,
  readJsonBody,
  type RefusalReason,
  sendApiRequest,
} from '../../shared/api/http.ts'
import {
  BAD_REQUEST,
  CONFLICT,
  CREATED,
  FORBIDDEN,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
} from '../../shared/api/httpStatus.ts'
import type { CreateEventRequest } from '../../shared/api/contract.ts'
import { eventPhaseAt, instantSchema, type EventPhase } from '../events/events.ts'
import { FIRST_ROUND, LAST_ROUND } from '../events/pairing.ts'

export const ADMIN_EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const

export type AdminEventStatus = (typeof ADMIN_EVENT_STATUSES)[number]

/** Corpo de GET /api/admin/events/{id} e dos POST que o devolvem (AdminEventResponse). */
const adminEventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  status: z.enum(ADMIN_EVENT_STATUSES),
  capacity: z.int(),
  /** Quantas pessoas se inscreveram; nunca quem. */
  registrationCount: z.int(),
})

/** Corpo de PUT e GET /api/admin/events/{eventId}/rounds/{number} (AdminRoundResponse): só contagens. */
const adminRoundSchema = z.object({
  eventId: z.uuid(),
  number: z.int().check(z.gte(FIRST_ROUND), z.lte(LAST_ROUND)),
  pairCount: z.int(),
  sittingOutCount: z.int(),
  startedAt: instantSchema,
})

/** Corpo de GET /api/admin/events: a última página vem com `nextPageToken` nulo. */
const adminEventPageSchema = z.object({
  items: z.array(adminEventSchema),
  nextPageToken: z.nullable(z.string()),
})

/** O que os schemas aceitam da API; o teste compara com os tipos gerados da spec. */
export type AdminEventWire = z.input<typeof adminEventSchema>
export type AdminEventPageWire = z.input<typeof adminEventPageSchema>
export type AdminRoundWire = z.input<typeof adminRoundSchema>

export type AdminEvent = Readonly<z.output<typeof adminEventSchema>>
export type AdminEventPage = Readonly<z.output<typeof adminEventPageSchema>>
export type AdminRound = Readonly<z.output<typeof adminRoundSchema>>

/**
 * O corpo de POST /api/admin/events. Vem da spec: os horários vão como ISO 8601 com o fuso de quem criou.
 */
export type NewEvent = Readonly<CreateEventRequest>

/** A fase do evento para a equipe: o rascunho vem antes das fases que o público conhece. */
export type AdminPhase = 'draft' | EventPhase

/** A fase no instante `now`. Rascunho é rascunho enquanto não for publicado, mesmo com o horário vencido. */
export function adminPhaseAt(event: Pick<AdminEvent, 'status' | 'startsAt' | 'endsAt'>, now: Date): AdminPhase {
  return event.status === 'DRAFT' ? 'draft' : eventPhaseAt({ ...event, status: event.status }, now)
}

/** Só o que ainda não acabou pode ser cancelado, rascunho ou publicado, inclusive em andamento. */
export function canCancelAt(event: Pick<AdminEvent, 'status' | 'endsAt'>, now: Date): boolean {
  return event.status !== 'CANCELLED' && now < event.endsAt
}

/**
 * Falhas de qualquer chamada da área da equipe. O front não sabe se quem chama é ADMIN, e a API decide:
 * `forbidden` é o 403 de quem não tem o papel.
 */
export type AdminFailure =
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'failed' }

export type CreateEventResult =
  | { readonly kind: 'created'; readonly event: AdminEvent }
  /** O 400: `fieldErrors` diz qual campo recusou e por quê; vazio se a API não listou nenhum. */
  | { readonly kind: 'invalid'; readonly fieldErrors: readonly FieldError[] }
  | AdminFailure

export type ReadEventResult = { readonly kind: 'found'; readonly event: AdminEvent } | AdminFailure

/**
 * O 409 de publicar ou cancelar. `reason` é o motivo que a API deu (ADR 0020 da duora-api), ou `null` sem
 * motivo; então vale a recusa genérica do status, que também cobre "mudou ao mesmo tempo por outra ação".
 */
export type EventActionResult =
  | { readonly kind: 'done'; readonly event: AdminEvent }
  | { readonly kind: 'refused'; readonly reason: RefusalReason | null }
  | AdminFailure

/** `rateLimited` é o 429 (limite de rodadas da conta); `contended` é o 503 (mesma rodada em andamento ou limite não contado). */
export type RoundBusyCause = 'rateLimited' | 'contended'

/**
 * `created` é o 201 (a rodada nasceu agora); `existing` é o 200 (já existia, e repetir devolve a mesma). Os
 * 409 de regra trazem o `reason`; sem ele, ou com um que o front não conhece, vale a recusa genérica.
 */
export type StartRoundResult =
  | { readonly kind: 'started'; readonly round: AdminRound; readonly isNew: boolean }
  | { readonly kind: 'notUnderway' }
  | { readonly kind: 'outOfSequence' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'busy'; readonly cause: RoundBusyCause; readonly retryAfterSeconds: number | null }
  | AdminFailure

const ADMIN_EVENTS_PATH = '/api/admin/events'

function eventPath(eventId: string): string {
  return `${ADMIN_EVENTS_PATH}/${encodeURIComponent(eventId)}`
}

function roundPath(eventId: string, number: number): string {
  return `${eventPath(eventId)}/rounds/${number}`
}

/** Os status que valem em toda chamada da área da equipe; `null` para o que cada chamada trata por si. */
function failureOf(error: ApiError): AdminFailure | null {
  switch (error.status) {
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case FORBIDDEN:
      return { kind: 'forbidden' }
    case NOT_FOUND:
      return { kind: 'notFound' }
    default:
      return null
  }
}

const FAILED: AdminFailure = { kind: 'failed' }

/** Falha esperada vira resultado; qualquer outra coisa é bug e sobe. */
function unexpectedFailure(error: unknown): AdminFailure {
  if (isApiFailure(error)) {
    return FAILED
  }
  throw error
}

/** Cria um rascunho. Repetir cria outro: a API não tem Idempotency-Key aqui (ADR 0016 da duora-api). */
export async function createEvent(newEvent: NewEvent): Promise<CreateEventResult> {
  try {
    const response = await sendApiRequest({ method: 'POST', path: ADMIN_EVENTS_PATH, body: newEvent })
    return { kind: 'created', event: await readJsonBody(response, adminEventSchema) }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === BAD_REQUEST) {
        return { kind: 'invalid', fieldErrors: error.fieldErrors }
      }
      return failureOf(error) ?? FAILED
    }
    return unexpectedFailure(error)
  }
}

/**
 * Uma página dos eventos de qualquer estado, do início mais distante ao mais antigo. `status` escolhe um só
 * estado; `null` traz todos. Quem não é ADMIN recebe 403 e sem sessão 401, e ambos sobem como `ApiError` para
 * a lista decidir o aviso (`adminFailureOf`).
 */
export async function fetchAdminEventsPage(
  pageToken: string | null,
  status: AdminEventStatus | null,
): Promise<AdminEventPage> {
  const query = new URLSearchParams()
  if (status !== null) {
    query.set('status', status)
  }
  if (pageToken !== null) {
    query.set('pageToken', pageToken)
  }
  const queryText = query.size === 0 ? '' : `?${query.toString()}`
  const response = await sendApiRequest({ method: 'GET', path: `${ADMIN_EVENTS_PATH}${queryText}` })
  return readJsonBody(response, adminEventPageSchema)
}

/** Como uma leitura que falhou aparece na lista: a sessão acabou, falta o papel ou deu erro. */
export function adminFailureOf(error: unknown): AdminFailure {
  return (error instanceof ApiError ? failureOf(error) : null) ?? FAILED
}

/** O evento com o estado guardado e a contagem de inscritos, rascunho incluído. */
export async function fetchAdminEvent(eventId: string): Promise<ReadEventResult> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: eventPath(eventId) })
    return { kind: 'found', event: await readJsonBody(response, adminEventSchema) }
  } catch (error) {
    if (error instanceof ApiError) {
      return failureOf(error) ?? FAILED
    }
    return unexpectedFailure(error)
  }
}

export function publishEvent(eventId: string): Promise<EventActionResult> {
  return changeEvent(eventId, 'publish')
}

export function cancelEvent(eventId: string): Promise<EventActionResult> {
  return changeEvent(eventId, 'cancel')
}

async function changeEvent(eventId: string, action: 'publish' | 'cancel'): Promise<EventActionResult> {
  try {
    const response = await sendApiRequest({ method: 'POST', path: `${eventPath(eventId)}:${action}` })
    return { kind: 'done', event: await readJsonBody(response, adminEventSchema) }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === CONFLICT) {
        return { kind: 'refused', reason: error.refusalReason }
      }
      return failureOf(error) ?? FAILED
    }
    return unexpectedFailure(error)
  }
}

/** Inicia a rodada. Repetir devolve a mesma rodada, então tentar de novo depois de uma falha é seguro. */
export async function startRound(eventId: string, number: number): Promise<StartRoundResult> {
  try {
    const response = await sendApiRequest({ method: 'PUT', path: roundPath(eventId, number) })
    return {
      kind: 'started',
      round: await readJsonBody(response, adminRoundSchema),
      isNew: response.status === CREATED,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return startRoundFailureOf(error)
    }
    return unexpectedFailure(error)
  }
}

function startRoundFailureOf(error: ApiError): StartRoundResult {
  switch (error.status) {
    case CONFLICT:
      return conflictOfRound(error.refusalReason)
    case TOO_MANY_REQUESTS:
      return { kind: 'busy', cause: 'rateLimited', retryAfterSeconds: error.retryAfterSeconds }
    case SERVICE_UNAVAILABLE:
      return { kind: 'busy', cause: 'contended', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return failureOf(error) ?? FAILED
  }
}

function conflictOfRound(reason: RefusalReason | null): StartRoundResult {
  switch (reason) {
    case 'EVENT_NOT_UNDERWAY':
      return { kind: 'notUnderway' }
    case 'ROUND_OUT_OF_SEQUENCE':
      return { kind: 'outOfSequence' }
    default:
      return { kind: 'refused' }
  }
}

/** O resultado da rodada (só contagens), ou `null` se o evento não tem rodada com esse número. */
export async function fetchAdminRound(eventId: string, number: number): Promise<AdminRound | null> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: roundPath(eventId, number) })
    return await readJsonBody(response, adminRoundSchema)
  } catch (error) {
    if (hasStatus(error, NOT_FOUND)) {
      return null
    }
    throw error
  }
}
