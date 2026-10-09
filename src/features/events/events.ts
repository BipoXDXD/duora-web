import { z } from 'zod/mini'
import { ApiError, readJsonBody, sendApiRequest } from '../../shared/api/http.ts'
import { FIRST_ROUND, LAST_ROUND } from './pairing.ts'

/** Instante com fuso, como a API manda; vira `Date` já na fronteira. */
export const instantSchema = z.pipe(
  z.iso.datetime({ offset: true }),
  z.transform((text) => new Date(text)),
)

export const EVENT_STATUSES = ['PUBLISHED', 'CANCELLED'] as const

/** Corpo de GET /api/events/{id} (EventResponse). O id volta para a API no caminho, por isso é conferido. */
const eventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  startsAt: instantSchema,
  endsAt: instantSchema,
  status: z.enum(EVENT_STATUSES),
  /** A última rodada iniciada, ou `null` antes da primeira. Na lista a API manda sempre `null`. */
  currentRound: z.nullable(z.int().check(z.gte(FIRST_ROUND), z.lte(LAST_ROUND))),
})

const eventPageSchema = z.object({
  items: z.array(eventSchema),
  nextPageToken: z.nullable(z.string()),
})

/** O que os schemas aceitam da API; o teste compara com os tipos gerados da spec. */
export type EventWire = z.input<typeof eventSchema>
export type EventPageWire = z.input<typeof eventPageSchema>

/** Um evento do Duora. "Social" só para não colidir com o `Event` do DOM. */
export type SocialEvent = Readonly<z.output<typeof eventSchema>>
export type EventPage = Readonly<z.output<typeof eventPageSchema>>

/**
 * A API só guarda publicado ou cancelado; "em andamento" e "encerrado" saem dos horários. O início conta
 * como em andamento e o fim como encerrado, como na API.
 */
export type EventPhase = 'upcoming' | 'inProgress' | 'ended' | 'cancelled'

export function eventPhaseAt(event: Pick<SocialEvent, 'status' | 'startsAt' | 'endsAt'>, now: Date): EventPhase {
  if (event.status === 'CANCELLED') {
    return 'cancelled'
  }
  if (now < event.startsAt) {
    return 'upcoming'
  }
  return now < event.endsAt ? 'inProgress' : 'ended'
}

/**
 * O próximo instante em que a fase de `eventPhaseAt` muda (o início, depois o fim), ou `null` quando ela não muda
 * mais: evento cancelado ou já encerrado. Em `now` igual ao limite a fase já mudou, então o limite devolvido é
 * sempre depois de `now`.
 */
export function nextPhaseChange(event: Pick<SocialEvent, 'status' | 'startsAt' | 'endsAt'>, now: Date): Date | null {
  if (event.status === 'CANCELLED') {
    return null
  }
  if (now < event.startsAt) {
    return event.startsAt
  }
  return now < event.endsAt ? event.endsAt : null
}

const EVENTS_PATH = '/api/events'
const NOT_FOUND = 404

/** `?pageToken=…` para as páginas depois da primeira; o tamanho é o padrão da API. */
export function pageQuery(pageToken: string | null): string {
  return pageToken === null ? '' : `?${new URLSearchParams({ pageToken }).toString()}`
}

/** Uma página dos eventos publicados que ainda vão começar, do mais próximo ao mais distante. */
export async function fetchEventsPage(pageToken: string | null): Promise<EventPage> {
  const response = await sendApiRequest({ method: 'GET', path: `${EVENTS_PATH}${pageQuery(pageToken)}` })
  return readJsonBody(response, eventPageSchema)
}

/** O evento, ou `null` se ele não existe (ou é rascunho, que a API responde igual). */
export async function fetchEvent(eventId: string): Promise<SocialEvent | null> {
  try {
    const response = await sendApiRequest({ method: 'GET', path: `${EVENTS_PATH}/${encodeURIComponent(eventId)}` })
    return await readJsonBody(response, eventSchema)
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND) {
      return null
    }
    throw error
  }
}
