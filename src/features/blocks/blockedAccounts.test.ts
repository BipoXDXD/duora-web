import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { BlockedAccountsResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import { type BlockedPageWire, fetchBlockedPage, unblockAccount } from './blockedAccounts.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

const BEA = { accountId: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b', blockedAt: '2026-10-03T12:00:00Z' }

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

describe('fetchBlockedPage', () => {
  it('asks for the first page without a token', async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextPageToken: null }))

    await fetchBlockedPage(null)

    const { path, init } = sentRequest()
    expect(path).toBe('/api/me/blocked-accounts')
    expect(init.method).toBe('GET')
  })

  it('asks for the next page with the token of the previous one, encoded', async () => {
    fetchMock.mockResolvedValue(json({ items: [], nextPageToken: null }))

    await fetchBlockedPage('abc+/=&x')

    expect(sentRequest().path).toBe('/api/me/blocked-accounts?pageToken=abc%2B%2F%3D%26x')
  })

  it('returns the blocks and the token of the next page', async () => {
    fetchMock.mockResolvedValue(json({ items: [BEA], nextPageToken: 'next' }))

    await expect(fetchBlockedPage(null)).resolves.toEqual({ items: [BEA], nextPageToken: 'next' })
  })

  it('accepts a time with fractions of a second and an offset', async () => {
    const block = { ...BEA, blockedAt: '2026-10-03T09:00:00.123456-03:00' }
    fetchMock.mockResolvedValue(json({ items: [block], nextPageToken: null }))

    await expect(fetchBlockedPage(null)).resolves.toEqual({ items: [block], nextPageToken: null })
  })

  it.each([
    ['an account id that is not a UUID', { items: [{ ...BEA, accountId: '../me/profile' }], nextPageToken: null }],
    ['a block time that is not a time', { items: [{ ...BEA, blockedAt: 'ontem' }], nextPageToken: null }],
    ['no next page token', { items: [] }],
    ['items that are not a list', { items: BEA, nextPageToken: null }],
  ])('fails on a page with %s', async (_case, body) => {
    fetchMock.mockResolvedValue(json(body))

    await expect(fetchBlockedPage(null)).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('fails with the API status on an error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchBlockedPage(null)).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('unblockAccount', () => {
  it('posts to the unblock action of the account, with the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await unblockAccount(BEA.accountId)

    const { path, init } = sentRequest()
    expect(path).toBe(`/api/accounts/${BEA.accountId}:unblock`)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('fails with the API status when the unblock is refused', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))

    await expect(unblockAccount(BEA.accountId)).rejects.toMatchObject({ name: 'ApiError', status: 403 })
  })
})

describe('contract with the generated API types', () => {
  it('reads a page the way the spec declares it', () => {
    expectTypeOf<BlockedPageWire>().toEqualTypeOf<BlockedAccountsResponse>()
  })
})
