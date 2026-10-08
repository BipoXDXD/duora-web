import { z } from 'zod/mini'
import type { DecideRequest } from '../../shared/api/contract.ts'
import { ApiError, isApiFailure, readJsonBody, sendApiRequest } from '../../shared/api/http.ts'
import { instantSchema } from '../events/events.ts'

/**
 * Corpo de PUT e GET /api/events/{eventId}/rounds/{number}/decision (DecisionResponse). Só a escolha de quem
 * chama e a data seguem para a tela: o resto já está na rota, e nada sobre o par entra no app.
 */
const decisionSchema = z.pipe(
  z.object({
    eventId: z.uuid(),
    roundNumber: z.number(),
    interested: z.boolean(),
    decidedAt: instantSchema,
  }),
  z.transform(({ interested, decidedAt }) => ({ interested, decidedAt })),
)

/** O que o schema aceita da API e o corpo enviado; o teste compara com os tipos gerados da spec. */
export type DecisionWire = z.input<typeof decisionSchema>
export type DecideBody = DecideRequest

/** A própria decisão numa rodada. `interested` é `true` para continuar em contato. */
export type Decision = Readonly<z.output<typeof decisionSchema>>

/**
 * O resultado de decidir. `alreadyDecided` é o 409 `DECISION_ALREADY_MADE`: a pessoa já tinha escolhido a
 * outra opção, e a decisão é final. Um 409 sem `reason`, ou com outro, não diz isso e vira `failed`.
 * `notPaired` é o 404: quem ficou de fora, não estava no sorteio ou pediu uma rodada que não existe.
 * `busy` junta o 503 (a API demorou além do teto) e o 429 (limite de decisões da conta), com o `Retry-After`
 * quando ele veio.
 */
export type DecideResult =
  | { readonly kind: 'decided'; readonly decision: Decision }
  | { readonly kind: 'alreadyDecided' }
  | { readonly kind: 'notPaired' }
  | { readonly kind: 'busy'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

const UNAUTHORIZED = 401
const NOT_FOUND = 404
const CONFLICT = 409
const TOO_MANY_REQUESTS = 429
const SERVICE_UNAVAILABLE = 503

function decisionPath(eventId: string, roundNumber: number): string {
  return `/api/events/${encodeURIComponent(eventId)}/rounds/${roundNumber}/decision`
}

/** A própria decisão na rodada, ou `null` sem decisão (a API responde 404 igual para quem não formou par). */
export async function fetchDecision(eventId: string, roundNumber: number): Promise<Decision | null> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: decisionPath(eventId, roundNumber) })
    return await readJsonBody(response, decisionSchema)
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND) {
      return null
    }
    throw error
  }
}

/** Grava a própria decisão. Repetir a mesma escolha é seguro; falhas esperadas viram resultado. */
export async function decide(eventId: string, roundNumber: number, interested: boolean): Promise<DecideResult> {
  const body: DecideBody = { interested }
  try {
    const response = await sendApiRequest({ method: 'PUT', path: decisionPath(eventId, roundNumber), body })
    return { kind: 'decided', decision: await readJsonBody(response, decisionSchema) }
  } catch (error) {
    if (error instanceof ApiError) {
      return decideResultOf(error)
    }
    if (isApiFailure(error)) {
      return { kind: 'failed' }
    }
    throw error
  }
}

function decideResultOf(error: ApiError): DecideResult {
  switch (error.status) {
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case NOT_FOUND:
      return { kind: 'notPaired' }
    case CONFLICT:
      return error.refusalReason === 'DECISION_ALREADY_MADE' ? { kind: 'alreadyDecided' } : { kind: 'failed' }
    case TOO_MANY_REQUESTS:
    case SERVICE_UNAVAILABLE:
      return { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
  }
}
