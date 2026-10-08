import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { MyRegistrationsPageResponse, RegistrationResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import {
  cancelRegistration,
  fetchMyRegistrationsPage,
  fetchRegistration,
  type MyRegistrationsPageWire,
  register,
  type RegistrationWire,
} from './registrations.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const REGISTRATION = { eventId: EVENT_ID, registeredAt: '2026-10-05T12:00:00Z' }
const REGISTRATION_PATH = `/api/events/${EVENT_ID}/registration`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function sentRequest(): { path: unknown; init: RequestInit } {
  const call = fetchMock.mock.calls[0]
  if (call === undefined) {
    throw new Error('fetch não foi chamado')
  }
  return { path: call[0], init: call[1] ?? {} }
}

describe('fetchRegistration', () => {
  it('reads the own registration in the event', async () => {
    fetchMock.mockResolvedValue(json(REGISTRATION))

    await expect(fetchRegistration(EVENT_ID)).resolves.toEqual({
      eventId: EVENT_ID,
      registeredAt: new Date('2026-10-05T12:00:00Z'),
    })
    expect(sentRequest().path).toBe(REGISTRATION_PATH)
  })

  it('returns null when there is no registration', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchRegistration(EVENT_ID)).resolves.toBeNull()
  })

  it('fails with the API status on another error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchRegistration(EVENT_ID)).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('register', () => {
  it('puts the registration, with the CSRF token and without a body', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(json(REGISTRATION, 201))

    await register(EVENT_ID)

    const { path, init } = sentRequest()
    expect(path).toBe(REGISTRATION_PATH)
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it.each([201, 200])('reports the registration on %s', async (status) => {
    fetchMock.mockResolvedValue(json(REGISTRATION, status))

    await expect(register(EVENT_ID)).resolves.toEqual({
      kind: 'registered',
      registration: { eventId: EVENT_ID, registeredAt: new Date('2026-10-05T12:00:00Z') },
    })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [403, { kind: 'profileIncomplete' }],
    [404, { kind: 'notFound' }],
    [409, { kind: 'unavailable' }],
    [500, { kind: 'failed' }],
  ] as const)('reports %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    await expect(register(EVENT_ID)).resolves.toEqual(result)
  })

  it('reports 503 as busy, with the seconds to wait', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503, headers: { 'Retry-After': '3' } }))

    await expect(register(EVENT_ID)).resolves.toEqual({ kind: 'busy', retryAfterSeconds: 3 })
  })

  it('reports a network failure as failed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(register(EVENT_ID)).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a body out of the contract as failed', async () => {
    fetchMock.mockResolvedValue(json({ eventId: 'x' }, 201))

    await expect(register(EVENT_ID)).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug propagate', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'))

    await expect(register(EVENT_ID)).rejects.toBeInstanceOf(RangeError)
  })
})

describe('cancelRegistration', () => {
  it('deletes the registration, with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(cancelRegistration(EVENT_ID)).resolves.toEqual({ kind: 'cancelled' })
    const { path, init } = sentRequest()
    expect(path).toBe(REGISTRATION_PATH)
    expect(init.method).toBe('DELETE')
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [404, { kind: 'notFound' }],
    [409, { kind: 'alreadyStarted' }],
    [500, { kind: 'failed' }],
  ] as const)('reports %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    await expect(cancelRegistration(EVENT_ID)).resolves.toEqual(result)
  })

  it('reports a network failure as failed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(cancelRegistration(EVENT_ID)).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug propagate', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'))

    await expect(cancelRegistration(EVENT_ID)).rejects.toBeInstanceOf(RangeError)
  })
})

describe('fetchMyRegistrationsPage', () => {
  const MINE = {
    eventId: EVENT_ID,
    title: 'Jantar às cegas',
    startsAt: '2026-10-10T22:00:00Z',
    endsAt: '2026-10-11T01:00:00Z',
    eventStatus: 'CANCELLED',
    registeredAt: '2026-10-05T12:00:00Z',
  }

  it('asks for the first page, then the next one by token', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ items: [], nextPageToken: null })))

    await fetchMyRegistrationsPage(null)
    await fetchMyRegistrationsPage('page-2')

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/me/registrations',
      '/api/me/registrations?pageToken=page-2',
    ])
  })

  it('returns the registrations with the times as dates', async () => {
    fetchMock.mockResolvedValue(json({ items: [MINE], nextPageToken: 'next' }))

    await expect(fetchMyRegistrationsPage(null)).resolves.toEqual({
      items: [
        {
          ...MINE,
          startsAt: new Date('2026-10-10T22:00:00Z'),
          endsAt: new Date('2026-10-11T01:00:00Z'),
          registeredAt: new Date('2026-10-05T12:00:00Z'),
        },
      ],
      nextPageToken: 'next',
    })
  })

  it('fails on a registration with an unknown event status', async () => {
    fetchMock.mockResolvedValue(json({ items: [{ ...MINE, eventStatus: 'DRAFT' }], nextPageToken: null }))

    await expect(fetchMyRegistrationsPage(null)).rejects.toBeInstanceOf(InvalidResponseError)
  })
})

describe('contract with the generated API types', () => {
  it('reads a registration the way the spec declares it', () => {
    expectTypeOf<RegistrationWire>().toEqualTypeOf<RegistrationResponse>()
  })

  it('reads a page of own registrations the way the spec declares it', () => {
    expectTypeOf<MyRegistrationsPageWire>().toEqualTypeOf<MyRegistrationsPageResponse>()
  })
})
