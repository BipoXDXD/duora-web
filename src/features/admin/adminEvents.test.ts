import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type {
  AdminEventResponse,
  AdminRoundResponse,
} from '../../shared/api/contract.ts'
import {
  cancelEvent,
  createEvent,
  fetchAdminEvent,
  fetchAdminRound,
  publishEvent,
  startRound,
  type AdminEventWire,
  type AdminRoundWire,
  type NewEvent,
} from './adminEvents.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const WIRE_EVENT = {
  id: EVENT_ID,
  title: 'Jantar às cegas',
  description: 'Uma noite de jogos de mesa.',
  startsAt: '2026-10-10T22:00:00Z',
  endsAt: '2026-10-11T01:00:00Z',
  status: 'DRAFT',
  capacity: 40,
  registrationCount: 3,
} as const
const EVENT = {
  ...WIRE_EVENT,
  startsAt: new Date('2026-10-10T22:00:00Z'),
  endsAt: new Date('2026-10-11T01:00:00Z'),
}
const WIRE_ROUND = {
  eventId: EVENT_ID,
  number: 2,
  pairCount: 12,
  sittingOutCount: 1,
  startedAt: '2026-10-10T23:15:00Z',
} as const
const ROUND = { ...WIRE_ROUND, startedAt: new Date('2026-10-10T23:15:00Z') }
const NEW_EVENT: NewEvent = {
  title: 'Jantar às cegas',
  description: 'Uma noite de jogos de mesa.',
  startsAt: '2026-10-10T19:00:00-03:00',
  endsAt: '2026-10-10T22:00:00-03:00',
  capacity: 40,
}

const EVENT_PATH = `/api/admin/events/${EVENT_ID}`
const ROUND_PATH = `${EVENT_PATH}/rounds/2`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function problem(status: number, extra: Readonly<Record<string, unknown>> = {}, headers = {}): Response {
  return new Response(JSON.stringify({ title: 'Erro', status, ...extra }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })
}

function sentRequest(): { path: unknown; init: RequestInit } {
  const call = fetchMock.mock.calls[0]
  if (call === undefined) {
    throw new Error('fetch não foi chamado')
  }
  return { path: call[0], init: call[1] ?? {} }
}

describe('createEvent', () => {
  it('posts the draft as JSON with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(json(WIRE_EVENT, 201))

    await createEvent(NEW_EVENT)

    const { path, init } = sentRequest()
    expect(path).toBe('/api/admin/events')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(NEW_EVENT)
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('returns the created draft with the times as dates', async () => {
    fetchMock.mockResolvedValue(json(WIRE_EVENT, 201))

    await expect(createEvent(NEW_EVENT)).resolves.toEqual({ kind: 'created', event: EVENT })
  })

  it('returns the refused fields of a 400', async () => {
    fetchMock.mockResolvedValue(
      problem(400, { errors: [{ field: 'capacity', code: 'ABOVE_MAXIMUM' }, { code: 'MALFORMED_BODY' }] }),
    )

    await expect(createEvent(NEW_EVENT)).resolves.toEqual({
      kind: 'invalid',
      fieldErrors: [
        { field: 'capacity', code: 'ABOVE_MAXIMUM' },
        { field: null, code: 'MALFORMED_BODY' },
      ],
    })
  })

  it('returns an invalid result without fields when the 400 lists none', async () => {
    fetchMock.mockResolvedValue(problem(400))

    await expect(createEvent(NEW_EVENT)).resolves.toEqual({ kind: 'invalid', fieldErrors: [] })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [403, { kind: 'forbidden' }],
    [415, { kind: 'failed' }],
    [500, { kind: 'failed' }],
  ] as const)('reports %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(problem(status))

    await expect(createEvent(NEW_EVENT)).resolves.toEqual(result)
  })

  it('reports a network failure as failed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(createEvent(NEW_EVENT)).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a body out of the contract as failed', async () => {
    fetchMock.mockResolvedValue(json({ id: 'x' }, 201))

    await expect(createEvent(NEW_EVENT)).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug propagate', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'))

    await expect(createEvent(NEW_EVENT)).rejects.toBeInstanceOf(RangeError)
  })
})

describe('fetchAdminEvent', () => {
  it('reads the event with its status and registration count', async () => {
    fetchMock.mockResolvedValue(json(WIRE_EVENT))

    await expect(fetchAdminEvent(EVENT_ID)).resolves.toEqual({ kind: 'found', event: EVENT })
    expect(sentRequest().path).toBe(EVENT_PATH)
    expect(sentRequest().init.method).toBe('GET')
  })

  it('ignores a field the spec does not declare', async () => {
    fetchMock.mockResolvedValue(json({ ...WIRE_EVENT, registrations: ['quem'] }))

    const result = await fetchAdminEvent(EVENT_ID)

    expect(result).toEqual({ kind: 'found', event: EVENT })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [403, { kind: 'forbidden' }],
    [404, { kind: 'notFound' }],
    [500, { kind: 'failed' }],
  ] as const)('reports %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(problem(status))

    await expect(fetchAdminEvent(EVENT_ID)).resolves.toEqual(result)
  })

  it('reports a status out of the contract as failed', async () => {
    fetchMock.mockResolvedValue(json({ ...WIRE_EVENT, status: 'ARCHIVED' }))

    await expect(fetchAdminEvent(EVENT_ID)).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a network failure as failed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchAdminEvent(EVENT_ID)).resolves.toEqual({ kind: 'failed' })
  })
})

describe.each([
  ['publishEvent', publishEvent, 'publish'],
  ['cancelEvent', cancelEvent, 'cancel'],
] as const)('%s', (_name, change, verb) => {
  it('posts the action on the event, without a body and with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(json({ ...WIRE_EVENT, status: 'PUBLISHED' }))

    await change(EVENT_ID)

    const { path, init } = sentRequest()
    expect(path).toBe(`${EVENT_PATH}:${verb}`)
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('returns the event as it is now', async () => {
    fetchMock.mockResolvedValue(json({ ...WIRE_EVENT, status: 'CANCELLED' }))

    await expect(change(EVENT_ID)).resolves.toEqual({ kind: 'done', event: { ...EVENT, status: 'CANCELLED' } })
  })

  it.each(['EVENT_ALREADY_PUBLISHED', 'EVENT_CANCELLED', 'EVENT_STARTED', 'EVENT_ENDED', 'UNRECOGNIZED'] as const)(
    'returns the reason %s of a 409',
    async (reason) => {
      fetchMock.mockResolvedValue(problem(409, { reason: reason === 'UNRECOGNIZED' ? 'EVENT_FROM_THE_FUTURE' : reason }))

      await expect(change(EVENT_ID)).resolves.toEqual({ kind: 'refused', reason })
    },
  )

  it('returns a 409 without a reason as a refusal without a reason', async () => {
    fetchMock.mockResolvedValue(problem(409))

    await expect(change(EVENT_ID)).resolves.toEqual({ kind: 'refused', reason: null })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [403, { kind: 'forbidden' }],
    [404, { kind: 'notFound' }],
    [400, { kind: 'failed' }],
    [500, { kind: 'failed' }],
  ] as const)('reports %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(problem(status))

    await expect(change(EVENT_ID)).resolves.toEqual(result)
  })

  it('reports a network failure as failed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(change(EVENT_ID)).resolves.toEqual({ kind: 'failed' })
  })
})

describe('startRound', () => {
  it('puts the round without a body and with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(json(WIRE_ROUND, 201))

    await startRound(EVENT_ID, 2)

    const { path, init } = sentRequest()
    expect(path).toBe(ROUND_PATH)
    expect(init.method).toBe('PUT')
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it.each([
    [201, true],
    [200, false],
  ])('reports %s as a round that is new: %s', async (status, isNew) => {
    fetchMock.mockResolvedValue(json(WIRE_ROUND, status))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual({ kind: 'started', round: ROUND, isNew })
  })

  it.each([
    ['EVENT_NOT_UNDERWAY', { kind: 'notUnderway' }],
    ['ROUND_OUT_OF_SEQUENCE', { kind: 'outOfSequence' }],
    ['EVENT_CANCELLED', { kind: 'refused' }],
    ['EVENT_FROM_THE_FUTURE', { kind: 'refused' }],
  ] as const)('reports a 409 with the reason %s as %o', async (reason, result) => {
    fetchMock.mockResolvedValue(problem(409, { reason }))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual(result)
  })

  it('reports a 409 without a reason as the generic refusal', async () => {
    fetchMock.mockResolvedValue(problem(409))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual({ kind: 'refused' })
  })

  it.each([
    [429, 'rateLimited'],
    [503, 'contended'],
  ] as const)('reports %s as busy because of %s, with the seconds to wait', async (status, cause) => {
    fetchMock.mockResolvedValue(problem(status, {}, { 'Retry-After': '7' }))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual({ kind: 'busy', cause, retryAfterSeconds: 7 })
  })

  it('reports a 429 without Retry-After as busy, without a wait', async () => {
    fetchMock.mockResolvedValue(problem(429))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual({ kind: 'busy', cause: 'rateLimited', retryAfterSeconds: null })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [403, { kind: 'forbidden' }],
    [404, { kind: 'notFound' }],
    [400, { kind: 'failed' }],
    [500, { kind: 'failed' }],
  ] as const)('reports %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(problem(status))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual(result)
  })

  it('reports a round out of the contract as failed', async () => {
    fetchMock.mockResolvedValue(json({ ...WIRE_ROUND, number: 101 }, 201))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a network failure as failed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(startRound(EVENT_ID, 2)).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug propagate', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'))

    await expect(startRound(EVENT_ID, 2)).rejects.toBeInstanceOf(RangeError)
  })
})

describe('fetchAdminRound', () => {
  it('reads the counts of the round', async () => {
    fetchMock.mockResolvedValue(json(WIRE_ROUND))

    await expect(fetchAdminRound(EVENT_ID, 2)).resolves.toEqual(ROUND)
    expect(sentRequest().path).toBe(ROUND_PATH)
    expect(sentRequest().init.method).toBe('GET')
  })

  it('returns null when the event has no such round', async () => {
    fetchMock.mockResolvedValue(problem(404))

    await expect(fetchAdminRound(EVENT_ID, 2)).resolves.toBeNull()
  })

  it.each([403, 500])('fails with the API status %s', async (status) => {
    fetchMock.mockResolvedValue(problem(status))

    await expect(fetchAdminRound(EVENT_ID, 2)).rejects.toMatchObject({ name: 'ApiError', status })
  })
})

describe('contract with the generated API types', () => {
  it('reads an admin event the way the spec declares it', () => {
    expectTypeOf<AdminEventWire>().toEqualTypeOf<AdminEventResponse>()
  })

  it('reads a round the way the spec declares it', () => {
    expectTypeOf<AdminRoundWire>().toEqualTypeOf<AdminRoundResponse>()
  })
})
