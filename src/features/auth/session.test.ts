import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { CurrentUserResponse } from '../../shared/api/contract.ts'
import { ApiError, InvalidResponseError, NetworkError } from '../../shared/api/http.ts'
import { type CurrentUserWire, fetchSession, logOut } from './session.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

function json(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
}

function sentRequest(): { path: unknown; init: RequestInit } {
  const call = fetchMock.mock.calls[0]
  if (call === undefined) {
    throw new Error('fetch não foi chamado')
  }
  return { path: call[0], init: call[1] ?? {} }
}

describe('fetchSession', () => {
  it('asks GET /api/me for the session', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana Souza"}'))

    await fetchSession()

    const { path, init } = sentRequest()
    expect(path).toBe('/api/me')
    expect(init.method).toBe('GET')
  })

  it('reports the user with the display name on 200', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana Souza"}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: 'Ana Souza' } })
  })

  it('reports a user without a name when the API sends a null display name', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":null}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: null } })
  })

  it.each(['', '   '])('treats a blank display name (%j) as no name', async (displayName) => {
    fetchMock.mockResolvedValue(json(JSON.stringify({ displayName })))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: null } })
  })

  it('trims the display name', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"  Ana  "}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: 'Ana' } })
  })

  it('keeps only the display name when the API sends more fields', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana","email":"ana@example.com","roles":["admin"]}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: 'Ana' } })
  })

  it('reports an anonymous visitor on 401', async () => {
    fetchMock.mockResolvedValue(json('{"type":"about:blank","title":"Unauthorized","status":401}', 401))

    await expect(fetchSession()).resolves.toEqual({ kind: 'anonymous' })
  })

  it.each([403, 404, 500, 503])('fails with the API status on %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    await expect(fetchSession()).rejects.toMatchObject({ name: 'ApiError', status })
  })

  it.each([
    ['without the display name', '{}'],
    ['with a display name that is not text', '{"displayName":42}'],
    ['that is not JSON', '<html>login</html>'],
  ])('fails on a 200 %s', async (_case, body) => {
    fetchMock.mockResolvedValue(json(body))

    await expect(fetchSession()).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('fails with a NetworkError when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchSession()).rejects.toBeInstanceOf(NetworkError)
  })
})

describe('logOut', () => {
  const ENTRA_LOGOUT = 'https://duoraapp.ciamlogin.com/tenant/oauth2/v2.0/logout?client_id=web&post_logout_redirect_uri=x'

  it('posts to /logout with the CSRF token from the XSRF-TOKEN cookie', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(json(JSON.stringify({ logoutUrl: ENTRA_LOGOUT })))

    await logOut()

    const { path, init } = sentRequest()
    expect(path).toBe('/logout')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('returns the Entra logout URL from the answer', async () => {
    fetchMock.mockResolvedValue(json(JSON.stringify({ logoutUrl: ENTRA_LOGOUT })))

    await expect(logOut()).resolves.toBe(ENTRA_LOGOUT)
  })

  it('fails with the API status when the logout is refused', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }))

    const error = await logOut().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403 })
  })

  it.each([
    ['a script URL', 'javascript:alert(1)'],
    ['a plain HTTP URL', 'http://duoraapp.ciamlogin.com/logout'],
    ['a relative path', '/logout/done'],
    ['an empty text', ''],
  ])('refuses to navigate to %s', async (_case, logoutUrl) => {
    fetchMock.mockResolvedValue(json(JSON.stringify({ logoutUrl })))

    await expect(logOut()).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('fails when the answer has no logout URL', async () => {
    fetchMock.mockResolvedValue(json('{}'))

    await expect(logOut()).rejects.toBeInstanceOf(InvalidResponseError)
  })
})

describe('contract with the generated API types', () => {
  // Só compila se o schema ler exatamente os campos que o tipo gerado da spec manda para o front. Se a spec
  // renomear, tornar opcional ou mudar o tipo de `displayName`, `npm run api:types` muda `schema.d.ts` e este
  // teste deixa de compilar, em vez de o parse falhar só em runtime.
  it('reads displayName the way the spec declares it', () => {
    expectTypeOf<CurrentUserWire>().toEqualTypeOf<Pick<CurrentUserResponse, 'displayName'>>()
  })
})
