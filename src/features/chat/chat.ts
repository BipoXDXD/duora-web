import { z } from 'zod/mini'
import type { SendMessageRequest } from '../../shared/api/contract.ts'
import {
  ApiError,
  type FieldError,
  hasStatus,
  isApiFailure,
  readJsonBody,
  sendApiRequest,
} from '../../shared/api/http.ts'
import {
  BAD_REQUEST,
  CONFLICT,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
} from '../../shared/api/httpStatus.ts'
import { instantSchema } from '../events/events.ts'

/** Corpo de GET /api/events/{eventId}/rounds/{number}/chat (Chat). Só `open` segue para a tela. */
const chatSchema = z.object({ chatId: z.uuid(), open: z.boolean(), lastSeq: z.int() })

/** Uma mensagem (ChatMessage). `seq` começa em 1 e não tem lacunas: é a ordem do chat e o cursor da leitura. */
const messageSchema = z.object({
  seq: z.int().check(z.positive()),
  fromMe: z.boolean(),
  text: z.string(),
  sentAt: instantSchema,
})

/** Corpo de GET .../chat/messages (ChatMessages). */
const messagePageSchema = z.object({ items: z.array(messageSchema), nextAfterSeq: z.nullable(z.int()) })

/** O que os schemas aceitam da API e o corpo enviado; o teste compara com os tipos gerados da spec. */
export type ChatAccessWire = z.input<typeof chatSchema>
export type MessageWire = z.input<typeof messageSchema>
export type MessagePageWire = z.input<typeof messagePageSchema>
export type SendBody = SendMessageRequest

export type ChatMessage = Readonly<z.output<typeof messageSchema>>

/**
 * Se a pessoa pode escrever no chat da rodada. `closed` não diz por quê, de propósito: a rodada seguinte, o fim do
 * evento, o chat cheio e um bloqueio chegam iguais da API. `notPaired` é o 404 de quem não formou par.
 */
export type ChatAccess = { readonly kind: 'open' } | { readonly kind: 'closed' } | { readonly kind: 'notPaired' }

/** Uma página de mensagens depois do cursor, em ordem de `seq`. `hasMore` pede a página seguinte já. */
export interface MessagePage {
  readonly items: readonly ChatMessage[]
  readonly hasMore: boolean
}

/** O texto a enviar e a chave da tentativa, a mesma em cada reenvio desse texto. */
export interface Outgoing {
  readonly key: string
  readonly text: string
}

/**
 * O resultado de um envio. `closed` é o 409 `CHAT_CLOSED`; `keyReused`, o 409 `IDEMPOTENCY_KEY_REUSED` (a chave
 * já gravou outro texto). `invalid` traz os erros por campo do 400. `busy` junta o 429 (limite da conta) e o 503
 * (outro envio segurou o chat), com o `Retry-After` quando veio. `failed` é o que vale reenviar com a mesma chave:
 * rede fora do ar, erro inesperado ou resposta fora do contrato.
 */
export type SendResult =
  | { readonly kind: 'sent'; readonly message: ChatMessage }
  | { readonly kind: 'closed' }
  | { readonly kind: 'keyReused' }
  | { readonly kind: 'invalid'; readonly fieldErrors: readonly FieldError[] }
  | { readonly kind: 'busy'; readonly retryAfterSeconds: number | null }
  | { readonly kind: 'notPaired' }
  | { readonly kind: 'signedOut' }
  | { readonly kind: 'failed' }

/** O maior `maxPageSize` que a API aceita: quem volta à aba recupera o atraso com menos idas. */
const MAX_PAGE_SIZE = 100

function chatPath(eventId: string, roundNumber: number): string {
  return `/api/events/${encodeURIComponent(eventId)}/rounds/${roundNumber}/chat`
}

export async function fetchChatAccess(eventId: string, roundNumber: number): Promise<ChatAccess> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: chatPath(eventId, roundNumber) })
    const { open } = await readJsonBody(response, chatSchema)
    return open ? { kind: 'open' } : { kind: 'closed' }
  } catch (error) {
    if (hasStatus(error, NOT_FOUND)) {
      return { kind: 'notPaired' }
    }
    throw error
  }
}

/** As mensagens depois de `afterSeq`, ou `null` no 404 de quem não formou par. Outras falhas propagam. */
export async function fetchMessagesAfter(
  eventId: string,
  roundNumber: number,
  afterSeq: number,
): Promise<MessagePage | null> {
  const path = `${chatPath(eventId, roundNumber)}/messages?afterSeq=${afterSeq}&maxPageSize=${MAX_PAGE_SIZE}`
  try {
    const { items, nextAfterSeq } = await readJsonBody(await sendApiRequest({ method: 'GET', path }), messagePageSchema)
    return { items, hasMore: nextAfterSeq !== null }
  } catch (error) {
    if (hasStatus(error, NOT_FOUND)) {
      return null
    }
    throw error
  }
}

/** Envia uma mensagem. Reenviar a mesma chave com o mesmo texto é seguro; falhas esperadas viram resultado. */
export async function sendMessage(eventId: string, roundNumber: number, outgoing: Outgoing): Promise<SendResult> {
  const body: SendBody = { text: outgoing.text }
  try {
    const response = await sendApiRequest({
      method: 'POST',
      path: `${chatPath(eventId, roundNumber)}/messages`,
      body,
      idempotencyKey: outgoing.key,
    })
    return { kind: 'sent', message: await readJsonBody(response, messageSchema) }
  } catch (error) {
    if (error instanceof ApiError) {
      return sendResultOf(error)
    }
    if (isApiFailure(error)) {
      return { kind: 'failed' }
    }
    throw error
  }
}

function sendResultOf(error: ApiError): SendResult {
  switch (error.status) {
    case BAD_REQUEST:
      return { kind: 'invalid', fieldErrors: error.fieldErrors }
    case UNAUTHORIZED:
      return { kind: 'signedOut' }
    case NOT_FOUND:
      return { kind: 'notPaired' }
    case CONFLICT:
      return conflictResultOf(error)
    case TOO_MANY_REQUESTS:
    case SERVICE_UNAVAILABLE:
      return { kind: 'busy', retryAfterSeconds: error.retryAfterSeconds }
    default:
      return { kind: 'failed' }
  }
}

function conflictResultOf(error: ApiError): SendResult {
  switch (error.refusalReason) {
    case 'CHAT_CLOSED':
      return { kind: 'closed' }
    case 'IDEMPOTENCY_KEY_REUSED':
      return { kind: 'keyReused' }
    default:
      return { kind: 'failed' }
  }
}
