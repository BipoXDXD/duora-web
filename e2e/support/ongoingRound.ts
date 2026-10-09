import { z } from 'zod/mini'
import type { ChatMessageResponse, DecisionResponse } from '../../src/shared/api/contract.ts'
import {
  aMessage,
  aRegistration,
  aSession,
  anEventInProgress,
  CHAT_ID,
  EVENT_ID,
  fromNow,
  PARTNER_ID,
} from './data.ts'
import { json, problem, type ApiAnswer, type ApiRequest, type FakeApi } from './fakeApi.ts'

const ROUND = 1
const API_EVENT = `/api/events/${EVENT_ID}`
export const CHAT_PATH = `${API_EVENT}/rounds/${ROUND}/chat`
export const DECISION_PATH = `${API_EVENT}/rounds/${ROUND}/decision`

/**
 * A rodada 1 de um evento em andamento do ponto de vista de quem está inscrito e tem dupla: o evento, a
 * inscrição, a dupla, a conversa e a decisão privada. O estado (mensagens, decisão) mora aqui e responde às
 * leituras e escritas como a API faria; o teste só declara de novo a rota que quer fazer falhar ou esperar.
 */
export class OngoingRound {
  readonly messages: ChatMessageResponse[]
  decision: DecisionResponse | null = null

  private readonly api: FakeApi

  private constructor(api: FakeApi, initialMessages: readonly ChatMessageResponse[]) {
    this.api = api
    this.messages = [...initialMessages]
  }

  /** Declara as rotas da rodada na API simulada e devolve o servidor, para o teste mexer no estado dele. */
  static declare(api: FakeApi, initialMessages: readonly ChatMessageResponse[] = []): OngoingRound {
    const round = new OngoingRound(api, initialMessages)
    round.declareRoutes()
    return round
  }

  /** A dupla escreve: a mensagem só aparece no app quando o polling a ler. */
  partnerSays(text: string): ChatMessageResponse {
    const message = aMessage(this.messages.length + 1, false, text, { sentAt: fromNow(0) })
    this.messages.push(message)
    return message
  }

  /** Grava a mensagem enviada por quem usa o app, como a API faz no 201. */
  accept(text: string): ChatMessageResponse {
    const message = aMessage(this.messages.length + 1, true, text, { sentAt: fromNow(0) })
    this.messages.push(message)
    return message
  }

  /** Grava a decisão, como a API faz no PUT; o teste a usa também para uma decisão tomada em outra aba. */
  storeDecision(interested: boolean): void {
    this.decision = { eventId: EVENT_ID, roundNumber: ROUND, interested, decidedAt: fromNow(0) }
  }

  /** A resposta 201 ao envio de `request`, gravando a mensagem. */
  acceptSent(request: ApiRequest): ApiAnswer {
    return json(201, this.accept(textOf(request)))
  }

  private declareRoutes(): void {
    this.api
      .on('GET', '/api/me', json(200, aSession()))
      .on('GET', API_EVENT, json(200, anEventInProgress()))
      .on('GET', `${API_EVENT}/registration`, json(200, aRegistration()))
      .on('GET', `${API_EVENT}/rounds/${ROUND}/pairing`, json(200, { eventId: EVENT_ID, roundNumber: ROUND, partnerAccountId: PARTNER_ID }))
      .on('GET', CHAT_PATH, () => json(200, { chatId: CHAT_ID, open: true, lastSeq: this.messages.length }))
      .on('GET', `${CHAT_PATH}/messages`, (request) => json(200, { items: this.messagesAfter(request), nextAfterSeq: null }))
      .on('POST', `${CHAT_PATH}/messages`, (request) => this.acceptSent(request))
      .on('GET', DECISION_PATH, () => (this.decision === null ? problem(404) : json(200, this.decision)))
      .on('PUT', DECISION_PATH, (request) => {
        this.storeDecision(z.object({ interested: z.boolean() }).parse(request.body).interested)
        return json(200, this.decision)
      })
  }

  private messagesAfter(request: ApiRequest): ChatMessageResponse[] {
    const afterSeq = Number(request.query.get('afterSeq') ?? 0)
    return this.messages.filter((message) => message.seq > afterSeq)
  }
}

function textOf(request: ApiRequest): string {
  return z.object({ text: z.string() }).parse(request.body).text
}
