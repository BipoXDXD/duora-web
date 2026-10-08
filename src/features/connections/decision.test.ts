import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { DecideRequest, DecisionResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import { decide, fetchDecision, type DecideBody, type Decision, type DecisionWire } from './decision.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const PATH = `/api/events/${EVENT_ID}/rounds/2/decision`
const YES = { eventId: EVENT_ID, roundNumber: 2, interested: true, decidedAt: '2026-10-10T23:30:00Z' }

function json(body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

describe('fetchDecision', () => {
  it('reads the own decision of the round', async () => {
    fetchMock.mockResolvedValue(json(YES))

    await expect(fetchDecision(EVENT_ID, 2)).resolves.toEqual({
      interested: true,
      decidedAt: new Date('2026-10-10T23:30:00Z'),
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(PATH)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET')
  })

  it('reports no decision yet on 404', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchDecision(EVENT_ID, 2)).resolves.toBeNull()
  })

  it('fails with the API status on another error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchDecision(EVENT_ID, 2)).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })

  it.each([
    ['interested that is not a boolean', { ...YES, interested: 'true' }],
    ['interested missing', { eventId: EVENT_ID, roundNumber: 2, decidedAt: YES.decidedAt }],
    ['a date without a time zone', { ...YES, decidedAt: '2026-10-10T23:30:00' }],
  ])('fails on %s', async (_case, body) => {
    fetchMock.mockResolvedValue(json(body))

    await expect(fetchDecision(EVENT_ID, 2)).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('keeps only the own choice and its date, whatever else the body brings', async () => {
    fetchMock.mockResolvedValue(json({ ...YES, partnerInterested: false, connected: true }))

    const decision = await fetchDecision(EVENT_ID, 2)

    expect(Object.keys(decision ?? {}).toSorted()).toEqual(['decidedAt', 'interested'])
  })
})

describe('decide', () => {
  it('sends the choice with PUT and the CSRF header', async () => {
    document.cookie = 'XSRF-TOKEN=token-1; path=/'
    fetchMock.mockResolvedValue(json({ ...YES, interested: false }, 201))

    await decide(EVENT_ID, 2, false)

    const [path, init] = fetchMock.mock.calls[0] ?? []
    expect(path).toBe(PATH)
    expect(init?.method).toBe('PUT')
    expect(init?.body).toBe('{"interested":false}')
    expect(new Headers(init?.headers).get('X-XSRF-TOKEN')).toBe('token-1')
    document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
  })

  it.each([201, 200])('reports the recorded decision on %i', async (status) => {
    fetchMock.mockResolvedValue(json(YES, status))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({
      kind: 'decided',
      decision: { interested: true, decidedAt: new Date('2026-10-10T23:30:00Z') },
    })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [404, { kind: 'notPaired' }],
    [409, { kind: 'failed' }],
    [400, { kind: 'failed' }],
    [500, { kind: 'failed' }],
  ])('turns %i into %o', async (status, result) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual(result)
  })

  it('turns a 409 with the reason DECISION_ALREADY_MADE into already decided', async () => {
    fetchMock.mockResolvedValue(json({ title: 'Conflict', status: 409, reason: 'DECISION_ALREADY_MADE' }, 409))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({ kind: 'alreadyDecided' })
  })

  it.each(['EVENT_FULL', 'SOMETHING_NEW'])(
    'does not call a 409 with the reason %s an already made decision',
    async (reason) => {
      fetchMock.mockResolvedValue(json({ title: 'Conflict', status: 409, reason }, 409))

      await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({ kind: 'failed' })
    },
  )

  it.each([503, 429])('asks to wait the Retry-After on %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status, headers: { 'Retry-After': '2' } }))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({ kind: 'busy', retryAfterSeconds: 2 })
  })

  it('asks to wait without a number when the API did not say how long', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({ kind: 'busy', retryAfterSeconds: null })
  })

  it('reports a failure when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a failure on a body outside the contract', async () => {
    fetchMock.mockResolvedValue(json({ ...YES, interested: 1 }, 201))

    await expect(decide(EVENT_ID, 2, true)).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug in our own code go up', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'))

    await expect(decide(EVENT_ID, 2, true)).rejects.toBeInstanceOf(RangeError)
  })
})

describe('contract with the generated API types', () => {
  it('reads a decision the way the spec declares it', () => {
    expectTypeOf<DecisionWire>().toEqualTypeOf<DecisionResponse>()
  })

  it('sends the body the spec declares', () => {
    expectTypeOf<DecideBody>().toEqualTypeOf<DecideRequest>()
  })

  it('keeps nothing about the partner in the decision the screen reads', () => {
    expectTypeOf<keyof Decision>().toEqualTypeOf<'interested' | 'decidedAt'>()
  })
})
