import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { CurrentUserResponse, LogoutResponse } from '../../shared/api/contract.ts'
import { ApiError, InvalidResponseError, NetworkError } from '../../shared/api/http.ts'
import { firstRequest } from '../../test/responses.ts'
import { type CurrentUserWire, fetchSession, KNOWN_ROLES, type LogoutResponseWire, logOut, type Role } from './session.ts'

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

describe('fetchSession', () => {
  it('asks GET /api/me for the session', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana Souza","roles":[]}'))

    await fetchSession()

    const { path, init } = firstRequest(fetchMock)
    expect(path).toBe('/api/me')
    expect(init.method).toBe('GET')
  })

  it('reports the user with the display name on 200', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana Souza","roles":[]}'))

    await expect(fetchSession()).resolves.toEqual({
      kind: 'authenticated',
      user: { displayName: 'Ana Souza', roles: [] },
    })
  })

  it('reports a user without a name when the API sends a null display name', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":null,"roles":[]}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: null, roles: [] } })
  })

  it.each(['', '   '])('treats a blank display name (%j) as no name', async (displayName) => {
    fetchMock.mockResolvedValue(json(JSON.stringify({ displayName, roles: [] })))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: null, roles: [] } })
  })

  it('trims the display name', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"  Ana  ","roles":[]}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: 'Ana', roles: [] } })
  })

  it('keeps only the fields the front uses when the API sends more', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana","email":"ana@example.com","roles":[]}'))

    await expect(fetchSession()).resolves.toEqual({ kind: 'authenticated', user: { displayName: 'Ana', roles: [] } })
  })

  it('reads the ADMIN role', async () => {
    fetchMock.mockResolvedValue(json('{"displayName":"Ana","roles":["ADMIN"]}'))

    await expect(fetchSession()).resolves.toEqual({
      kind: 'authenticated',
      user: { displayName: 'Ana', roles: ['ADMIN'] },
    })
  })

  it.each([
    ['an unknown role', '["MODERATOR"]', []],
    ['the known role among unknown ones', '["MODERATOR","ADMIN"]', ['ADMIN']],
    ['a role in lowercase, which is not the one the API sends', '["admin"]', []],
    ['the same role twice', '["ADMIN","ADMIN"]', ['ADMIN']],
  ])('ignores what is not on the allowlist: %s', async (_case, roles, expected) => {
    fetchMock.mockResolvedValue(json(`{"displayName":"Ana","roles":${roles}}`))

    await expect(fetchSession()).resolves.toEqual({
      kind: 'authenticated',
      user: { displayName: 'Ana', roles: expected },
    })
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
    ['without the display name', '{"roles":[]}'],
    ['with a display name that is not text', '{"displayName":42,"roles":[]}'],
    ['without the roles, which the API always sends', '{"displayName":"Ana"}'],
    ['with roles that are not a list', '{"displayName":"Ana","roles":"ADMIN"}'],
    ['with a role that is not text', '{"displayName":"Ana","roles":[1]}'],
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

    const { path, init } = firstRequest(fetchMock)
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
    expectTypeOf<CurrentUserWire['displayName']>().toEqualTypeOf<CurrentUserResponse['displayName']>()
  })

  it('knows the same roles the spec declares', () => {
    expectTypeOf<Role>().toEqualTypeOf<CurrentUserResponse['roles'][number]>()
    expect(new Set(KNOWN_ROLES).size).toBe(KNOWN_ROLES.length)
  })

  it('accepts whatever the spec says the API sends', () => {
    expectTypeOf<CurrentUserResponse>().toExtend<CurrentUserWire>()
  })

  it('reads logoutUrl the way the spec declares it', () => {
    expectTypeOf<LogoutResponseWire>().toEqualTypeOf<LogoutResponse>()
  })
})
