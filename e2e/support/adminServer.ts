import { z } from 'zod/mini'
import type { AdminEventResponse } from '../../src/shared/api/contract.ts'
import { ADMIN_EVENT_ID, anAdminEvent } from './data.ts'
import { json, type ApiAnswer, type ApiRequest, type FakeApi } from './fakeApi.ts'

export const ADMIN_EVENTS_PATH = '/api/admin/events'

/** O corpo de POST /api/admin/events: só estes campos (a API rejeita campo desconhecido). */
const createSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  capacity: z.int(),
})

/** Os eventos da área da equipe: a lista, o rascunho que nasce na criação e a publicação dele. */
export class AdminServer {
  readonly events: AdminEventResponse[]
  private readonly api: FakeApi

  constructor(api: FakeApi, events: readonly AdminEventResponse[] = [anAdminEvent()]) {
    this.api = api
    this.events = [...events]
    api
      .on('GET', ADMIN_EVENTS_PATH, () => json(200, { items: this.events, nextPageToken: null }))
      .on('POST', ADMIN_EVENTS_PATH, (request) => this.createDraft(request))
  }

  static eventPath(eventId: string): string {
    return `${ADMIN_EVENTS_PATH}/${eventId}`
  }

  private createDraft(request: ApiRequest): ApiAnswer {
    const draft: AdminEventResponse = {
      ...createSchema.parse(request.body),
      // Os ids são de teste; basta serem distintos do evento que já existia.
      id: ADMIN_EVENT_ID.replace(/.$/, String(this.events.length)),
      status: 'DRAFT',
      registrationCount: 0,
    }
    this.events.push(draft)
    this.api
      .on('GET', AdminServer.eventPath(draft.id), () => json(200, this.find(draft.id)))
      .on('POST', `${AdminServer.eventPath(draft.id)}:publish`, () => json(200, this.publish(draft.id)))
    return json(201, draft)
  }

  private find(eventId: string): AdminEventResponse {
    const found = this.events.find((event) => event.id === eventId)
    if (found === undefined) {
      throw new Error(`evento ${eventId} não existe`)
    }
    return found
  }

  private publish(eventId: string): AdminEventResponse {
    const published: AdminEventResponse = { ...this.find(eventId), status: 'PUBLISHED' }
    this.events.splice(this.events.indexOf(this.find(eventId)), 1, published)
    return published
  }
}
