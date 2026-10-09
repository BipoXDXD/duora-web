import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { PairingResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import { jsonResponse } from '../../test/responses.ts'
import { fetchPairing, type PairingWire } from './pairing.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const PARTNER_ID = '0199a1d2-1111-7aaa-8bbb-cccccccccccc'

describe('fetchPairing', () => {
  it('asks for the own place in the round of the event', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ eventId: EVENT_ID, roundNumber: 2, partnerAccountId: PARTNER_ID }))

    await fetchPairing(EVENT_ID, 2)

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/events/${EVENT_ID}/rounds/2/pairing`)
  })

  it('reports the partner', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ eventId: EVENT_ID, roundNumber: 2, partnerAccountId: PARTNER_ID }))

    await expect(fetchPairing(EVENT_ID, 2)).resolves.toEqual({ kind: 'paired', partnerAccountId: PARTNER_ID })
  })

  it('reports sitting out when the partner is null', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ eventId: EVENT_ID, roundNumber: 1, partnerAccountId: null }))

    await expect(fetchPairing(EVENT_ID, 1)).resolves.toEqual({ kind: 'sittingOut' })
  })

  it('reports no place in the round on 404', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchPairing(EVENT_ID, 3)).resolves.toEqual({ kind: 'notInRound' })
  })

  it('fails with the API status on another error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchPairing(EVENT_ID, 1)).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })

  it('fails on a partner id that is not a UUID', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ eventId: EVENT_ID, roundNumber: 1, partnerAccountId: 'ana' }))

    await expect(fetchPairing(EVENT_ID, 1)).rejects.toBeInstanceOf(InvalidResponseError)
  })
})

describe('contract with the generated API types', () => {
  it('reads a pairing the way the spec declares it', () => {
    expectTypeOf<PairingWire>().toEqualTypeOf<PairingResponse>()
  })
})
