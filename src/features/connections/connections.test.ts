import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { ConnectionsResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import { jsonResponse } from '../../test/responses.ts'
import { fetchConnectionsPage, type ConnectionsPageWire } from './connections.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

const BEA = { accountId: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b', connectedAt: '2026-10-03T12:00:00Z' }

describe('fetchConnectionsPage', () => {
  it('asks for the first page without a token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [BEA], nextPageToken: 'abc' }))

    await expect(fetchConnectionsPage(null)).resolves.toEqual({
      items: [{ accountId: BEA.accountId, connectedAt: new Date(BEA.connectedAt) }],
      nextPageToken: 'abc',
    })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/me/connections')
  })

  it('asks for the next page with the token, encoded', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextPageToken: null }))

    await fetchConnectionsPage('a+b/c=')

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/me/connections?pageToken=a%2Bb%2Fc%3D')
  })

  it('fails with the API status on an error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    await expect(fetchConnectionsPage(null)).rejects.toMatchObject({ name: 'ApiError', status: 401 })
  })

  it.each([
    ['an account id that is not a UUID', { items: [{ ...BEA, accountId: 'bea' }], nextPageToken: null }],
    ['a date that is not an instant', { items: [{ ...BEA, connectedAt: 'ontem' }], nextPageToken: null }],
    ['no next page token', { items: [BEA] }],
  ])('fails on %s', async (_case, body) => {
    fetchMock.mockResolvedValue(jsonResponse(body))

    await expect(fetchConnectionsPage(null)).rejects.toBeInstanceOf(InvalidResponseError)
  })
})

describe('contract with the generated API types', () => {
  it('reads a page of connections the way the spec declares it', () => {
    expectTypeOf<ConnectionsPageWire>().toEqualTypeOf<ConnectionsResponse>()
  })
})
