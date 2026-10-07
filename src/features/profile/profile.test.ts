import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { EditProfileRequest, ProfileResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import { editProfile, fetchProfile, type ProfileWire, REGION_NAMES, type Region } from './profile.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
})

const ANA = {
  displayName: 'Ana Souza',
  birthDate: '1990-05-10',
  bio: 'Gosto de jogos de cartas.',
  region: 'BR-SP',
  complete: true,
} as const

function profileAnswer(body: unknown, etag: string | null = '"4"', status = 200): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (etag !== null) {
    headers.set('ETag', etag)
  }
  return new Response(JSON.stringify(body), { status, headers })
}

function problemAnswer(status: number, detail?: string): Response {
  return new Response(JSON.stringify({ title: 'Erro', status, detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

function sentRequest(): { path: unknown; init: RequestInit } {
  const call = fetchMock.mock.calls[0]
  if (call === undefined) {
    throw new Error('fetch não foi chamado')
  }
  return { path: call[0], init: call[1] ?? {} }
}

describe('fetchProfile', () => {
  it('asks GET /api/me/profile', async () => {
    fetchMock.mockResolvedValue(profileAnswer(ANA))

    await fetchProfile()

    const { path, init } = sentRequest()
    expect(path).toBe('/api/me/profile')
    expect(init.method).toBe('GET')
  })

  it('returns the profile with the version from the ETag', async () => {
    fetchMock.mockResolvedValue(profileAnswer(ANA, '"4"'))

    await expect(fetchProfile()).resolves.toEqual({ profile: ANA, etag: '"4"' })
  })

  it('returns an empty profile, as every account has before the first edit', async () => {
    const empty = { displayName: null, birthDate: null, bio: null, region: null, complete: false }
    fetchMock.mockResolvedValue(profileAnswer(empty, '"0"'))

    await expect(fetchProfile()).resolves.toEqual({ profile: empty, etag: '"0"' })
  })

  it('keeps only the fields of the contract', async () => {
    fetchMock.mockResolvedValue(profileAnswer({ ...ANA, accountId: '0199-x', email: 'ana@example.com' }))

    const { profile } = await fetchProfile()

    expect(Object.keys(profile).toSorted()).toEqual(['bio', 'birthDate', 'complete', 'displayName', 'region'])
  })

  it('fails when the answer has no ETag, since the profile could not be edited', async () => {
    fetchMock.mockResolvedValue(profileAnswer(ANA, null))

    await expect(fetchProfile()).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it.each([
    ['a region that is not a Brazilian state', { ...ANA, region: 'US-CA' }],
    ['a birth date that is not a date', { ...ANA, birthDate: '10/05/1990' }],
    ['a missing field', { displayName: 'Ana', birthDate: null, bio: null, complete: false }],
    ['a name that is not text', { ...ANA, displayName: 42 }],
  ])('fails on a profile with %s', async (_case, body) => {
    fetchMock.mockResolvedValue(profileAnswer(body))

    await expect(fetchProfile()).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('fails with the API status when the read is refused', async () => {
    fetchMock.mockResolvedValue(problemAnswer(500))

    await expect(fetchProfile()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('editProfile', () => {
  it('patches only the given fields, with the version it read and the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(profileAnswer(ANA, '"5"'))

    await editProfile('"4"', { bio: null })

    const { path, init } = sentRequest()
    const headers = new Headers(init.headers)
    expect(path).toBe('/api/me/profile')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe('{"bio":null}')
    expect(headers.get('If-Match')).toBe('"4"')
    expect(headers.get('X-XSRF-TOKEN')).toBe('csrf-123')
  })

  it('returns the saved profile with the new version', async () => {
    fetchMock.mockResolvedValue(profileAnswer(ANA, '"5"'))

    await expect(editProfile('"4"', { displayName: 'Ana Souza' })).resolves.toEqual({
      kind: 'saved',
      saved: { profile: ANA, etag: '"5"' },
    })
  })

  it('reports an outdated version on 412', async () => {
    fetchMock.mockResolvedValue(problemAnswer(412))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'outdated' })
  })

  it('reports a birth date that can no longer change on 409', async () => {
    fetchMock.mockResolvedValue(problemAnswer(409))

    await expect(editProfile('"4"', { birthDate: '1991-01-01' })).resolves.toEqual({ kind: 'birthDateLocked' })
  })

  it.each([
    ['displayName contains a forbidden character', 'displayName'],
    ['birthDate must be at least 18 years ago', 'birthDate'],
    ['bio must have at most 300 characters', 'bio'],
    ['region must be the ISO 3166-2 code of a Brazilian state, like BR-SP', 'region'],
  ] as const)('points a 400 saying "%s" to the %s field', async (detail, field) => {
    fetchMock.mockResolvedValue(problemAnswer(400, detail))

    await expect(editProfile('"4"', {})).resolves.toEqual({ kind: 'invalid', field })
  })

  it.each([
    ['a detail about no field', 'JSON parse error'],
    ['a detail that only starts like a field', 'bioData is wrong'],
    ['no detail', undefined],
  ])('reports a 400 with %s without a field', async (_case, detail) => {
    fetchMock.mockResolvedValue(problemAnswer(400, detail))

    await expect(editProfile('"4"', {})).resolves.toEqual({ kind: 'invalid', field: null })
  })

  it('reports an expired session on 401', async () => {
    fetchMock.mockResolvedValue(problemAnswer(401))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'signedOut' })
  })

  it.each([403, 415, 428, 500, 503])('reports a failure on %i', async (status) => {
    fetchMock.mockResolvedValue(problemAnswer(status))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a failure when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a failure when the saved profile is out of the contract', async () => {
    fetchMock.mockResolvedValue(profileAnswer({ ...ANA, region: 'Narnia' }))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug propagate instead of reporting it as a failed save', async () => {
    const bug = new RangeError('bug')
    fetchMock.mockRejectedValue(bug)

    await expect(editProfile('"4"', { bio: 'Oi' })).rejects.toBe(bug)
  })
})

describe('regions', () => {
  it('names every Brazilian state and the Federal District', () => {
    expect(Object.keys(REGION_NAMES)).toHaveLength(27)
    expect(REGION_NAMES['BR-SP']).toBe('São Paulo')
    expect(REGION_NAMES['BR-DF']).toBe('Distrito Federal')
  })
})

describe('contract with the generated API types', () => {
  // Só compila se o schema ler exatamente o ProfileResponse da spec, com a mesma lista de regiões. Se a spec
  // mudar, `npm run api:types` muda `schema.d.ts` e este teste deixa de compilar.
  it('reads the profile the way the spec declares it', () => {
    expectTypeOf<ProfileWire>().toEqualTypeOf<ProfileResponse>()
  })

  it('knows the same regions the edit accepts', () => {
    expectTypeOf<Region>().toEqualTypeOf<NonNullable<EditProfileRequest['region']>>()
  })
})
