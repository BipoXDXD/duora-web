import { z } from 'zod/mini'
import { hasStatus, readJsonBody, sendApiRequest } from '../../shared/api/http.ts'
import { NOT_FOUND } from '../../shared/api/httpStatus.ts'

/** Corpo de GET /api/events/{eventId}/rounds/{number}/pairing (PairingResponse). */
const pairingSchema = z.object({
  eventId: z.uuid(),
  roundNumber: z.number(),
  partnerAccountId: z.nullable(z.uuid()),
})

/** O que o schema aceita da API; o teste compara com o tipo gerado da spec. */
export type PairingWire = z.input<typeof pairingSchema>

/**
 * O lugar de quem chama na rodada. `notInRound` junta o que a API não distingue: a rodada ainda não
 * começou, não existe, ou a pessoa não estava no sorteio.
 */
export type Pairing =
  | { readonly kind: 'paired'; readonly partnerAccountId: string }
  | { readonly kind: 'sittingOut' }
  | { readonly kind: 'notInRound' }

/** A API aceita rodadas de 1 a 100. */
export const FIRST_ROUND = 1
export const LAST_ROUND = 100

export async function fetchPairing(eventId: string, roundNumber: number): Promise<Pairing> {
  const path = `/api/events/${encodeURIComponent(eventId)}/rounds/${roundNumber}/pairing`
  try {
    const { partnerAccountId } = await readJsonBody(await sendApiRequest({ method: 'GET', path }), pairingSchema)
    return partnerAccountId === null ? { kind: 'sittingOut' } : { kind: 'paired', partnerAccountId }
  } catch (error) {
    if (hasStatus(error, NOT_FOUND)) {
      return { kind: 'notInRound' }
    }
    throw error
  }
}
