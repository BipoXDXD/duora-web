import { z } from 'zod/mini'
import type { ReportChatMessageRequest } from '../../shared/api/contract.ts'
import { ApiError, isApiFailure, readJsonBody, sendApiRequest, type FieldError } from '../../shared/api/http.ts'
import {
  BAD_REQUEST,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
} from '../../shared/api/httpStatus.ts'

/** Os motivos de denúncia, na ordem da tela; o teste confere com a lista da spec (a mesma de `fileReport`). */
export const REPORT_REASONS = [
  'HARASSMENT',
  'HATE_SPEECH',
  'SEXUAL_CONTENT',
  'VIOLENCE_OR_THREAT',
  'SCAM_OR_SPAM',
  'FAKE_PROFILE',
  'SUSPECTED_MINOR',
  'OTHER',
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

/** O corpo enviado. `description` é `null` quando a pessoa não escreveu nada; com `OTHER` a API a exige. */
export interface ReportBody extends ReportChatMessageRequest {
  readonly reason: ReportReason
  readonly description: string | null
}

/**
 * Do 201 (ChatMessageReport) o front só usa a conta denunciada, para o bloqueio opcional logo depois. O resto
 * (motivo, relato, estado) é o que a pessoa acabou de mandar ou não aparece na tela.
 */
const reportedSchema = z.object({ reportedAccountId: z.uuid() })

/** O que o schema aceita da API; o teste compara com o tipo gerado da spec. */
export type ReportedWire = z.input<typeof reportedSchema>

/**
 * O resultado de uma denúncia. `quotaExhausted` é o 429 da cota diária (10 denúncias, somando as de perfil);
 * `unavailable`, o 503 de quando a cota não pôde ser conferida. Os dois trazem o `Retry-After` quando veio.
 * `failed` junta rede fora do ar, erro inesperado e resposta fora do contrato: vale tentar de novo.
 */
export type ReportResult =
  | { readonly kind: 'reported'; readonly reportedAccountId: string }
  | { readonly kind: 'invalid'; readonly fieldErrors: readonly FieldError[] }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'quotaExhausted'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'unavailable'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

/** Denuncia a mensagem do par na posição `seq`. Falhas esperadas viram resultado; bug no código sobe. */
export async function reportMessage(
  eventId: string,
  roundNumber: number,
  seq: number,
  body: ReportBody,
): Promise<ReportResult> {
  const path = `/api/events/${encodeURIComponent(eventId)}/rounds/${roundNumber}/chat/messages/${seq}:report`
  try {
    const { reportedAccountId } = await readJsonBody(await sendApiRequest({ method: 'POST', path, body }), reportedSchema)
    return { kind: 'reported', reportedAccountId }
  } catch (error) {
    if (error instanceof ApiError) {
      return reportResultOf(error)
    }
    if (isApiFailure(error)) {
      return { kind: 'failed' }
    }
    throw error
  }
}

function reportResultOf(error: ApiError): ReportResult {
  switch (error.status) {
    case BAD_REQUEST:
      return { kind: 'invalid', fieldErrors: error.fieldErrors }
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case NOT_FOUND:
      return { kind: 'notFound' }
    case TOO_MANY_REQUESTS:
      return { kind: 'quotaExhausted', retryAfterSeconds: error.retryAfterSeconds }
    case SERVICE_UNAVAILABLE:
      return { kind: 'unavailable', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
  }
}
