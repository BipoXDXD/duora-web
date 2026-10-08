import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { EventResponse, EventsPageResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import {
  type EventPageWire,
  type EventWire,
  eventPhaseAt,
  fetchEvent,
  fetchEventsPage,
  type SocialEvent,
} from './events.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

const DINNER = {
  id: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b',
  title: 'Jantar às cegas',
  description: 'Uma noite de jogos de mesa.',
  startsAt: '2026-10-10T22:00:00Z',
  endsAt: '2026-10-11T01:00:00Z',
  status: 'PUBLISHED',
} as const

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function sentPath(): unknown {
  return fetchMock.mock.calls[0]?.[0]
}

describe('fetchEventsPage', () => {
  it('asks for the first page without a token', async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextPageToken: null }))

    await fetchEventsPage(null)

    expect(sentPath()).toBe('/api/events')
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('asks for the next page with the token of the previous one', async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextPageToken: null }))

    await fetchEventsPage('abc_-1')

    expect(sentPath()).toBe('/api/events?pageToken=abc_-1')
  })

  it('returns the events with the times as dates, and the next page token', async () => {
    fetchMock.mockResolvedValue(json({ items: [DINNER], nextPageToken: 'next' }))

    const page = await fetchEventsPage(null)

    expect(page.nextPageToken).toBe('next')
    expect(page.items).toEqual([
      { ...DINNER, startsAt: new Date('2026-10-10T22:00:00Z'), endsAt: new Date('2026-10-11T01:00:00Z') },
    ])
  })

  it.each([
    ['an id that is not a UUID', { ...DINNER, id: '../me' }],
    ['a start that is not a time', { ...DINNER, startsAt: 'amanhã' }],
    ['an unknown status', { ...DINNER, status: 'DRAFT' }],
    ['no title', { ...DINNER, title: undefined }],
  ])('fails on an event with %s', async (_case, event) => {
    fetchMock.mockResolvedValue(json({ items: [event], nextPageToken: null }))

    await expect(fetchEventsPage(null)).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('fails with the API status on an error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchEventsPage(null)).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('fetchEvent', () => {
  it('reads the event by its id', async () => {
    fetchMock.mockResolvedValue(json(DINNER))

    const event = await fetchEvent(DINNER.id)

    expect(sentPath()).toBe(`/api/events/${DINNER.id}`)
    expect(event?.title).toBe('Jantar às cegas')
  })

  it('returns null when the event does not exist', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchEvent(DINNER.id)).resolves.toBeNull()
  })

  it('fails with the API status on another error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchEvent(DINNER.id)).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('eventPhaseAt', () => {
  const event: SocialEvent = {
    ...DINNER,
    startsAt: new Date('2026-10-10T22:00:00Z'),
    endsAt: new Date('2026-10-11T01:00:00Z'),
  }

  it.each([
    ['2026-10-10T21:59:59.999Z', 'upcoming'],
    ['2026-10-10T22:00:00Z', 'inProgress'],
    ['2026-10-11T00:59:59.999Z', 'inProgress'],
    ['2026-10-11T01:00:00Z', 'ended'],
  ] as const)('at %s a published event is %s', (now, phase) => {
    expect(eventPhaseAt(event, new Date(now))).toBe(phase)
  })

  it.each(['2026-10-10T21:00:00Z', '2026-10-10T23:00:00Z', '2026-10-11T02:00:00Z'])(
    'a cancelled event is cancelled at %s, whatever the time',
    (now) => {
      expect(eventPhaseAt({ ...event, status: 'CANCELLED' }, new Date(now))).toBe('cancelled')
    },
  )
})

describe('contract with the generated API types', () => {
  it('reads an event the way the spec declares it', () => {
    expectTypeOf<EventWire>().toEqualTypeOf<EventResponse>()
  })

  it('reads a page of events the way the spec declares it', () => {
    expectTypeOf<EventPageWire>().toEqualTypeOf<EventsPageResponse>()
  })
})
