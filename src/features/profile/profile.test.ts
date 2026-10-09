import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { EditProfileRequest, ProfileResponse } from '../../shared/api/contract.ts'
import { InvalidResponseError } from '../../shared/api/http.ts'
import { firstRequest, problemResponse } from '../../test/responses.ts'
import {
  editProfile,
  fetchProfile,
  isProfileField,
  PROFILE_FIELDS,
  type ProfileField,
  type ProfileWire,
  REGION_NAMES,
  type Region,
} from './profile.ts'

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

describe('fetchProfile', () => {
  it('asks GET /api/me/profile', async () => {
    fetchMock.mockResolvedValue(profileAnswer(ANA))

    await fetchProfile()

    const { path, init } = firstRequest(fetchMock)
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
    fetchMock.mockResolvedValue(problemResponse(500))

    await expect(fetchProfile()).rejects.toMatchObject({ name: 'ApiError', status: 500 })
  })
})

describe('editProfile', () => {
  it('patches only the given fields, with the version it read and the CSRF token', async () => {
    document.cookie = 'XSRF-TOKEN=csrf-123; path=/'
    fetchMock.mockResolvedValue(profileAnswer(ANA, '"5"'))

    await editProfile('"4"', { bio: null })

    const { path, init } = firstRequest(fetchMock)
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
    fetchMock.mockResolvedValue(problemResponse(412))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'outdated' })
  })

  it('reports a birth date that can no longer change on a 409 BIRTH_DATE_ALREADY_SET', async () => {
    fetchMock.mockResolvedValue(problemResponse(409, { reason: 'BIRTH_DATE_ALREADY_SET' }))

    await expect(editProfile('"4"', { birthDate: '1991-01-01' })).resolves.toEqual({ kind: 'birthDateLocked' })
  })

  it.each([
    ['has no reason', () => problemResponse(409)],
    ['has a reason the front does not know', () => problemResponse(409, { reason: 'SOMETHING_NEW' })],
  ])('reports a failure when a 409 %s, since it does not say the birth date is locked', async (_case, answer) => {
    fetchMock.mockResolvedValue(answer())

    await expect(editProfile('"4"', { birthDate: '1991-01-01' })).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a 400 with the fields the API refused, in the order it listed them', async () => {
    fetchMock.mockResolvedValue(
      problemResponse(400, {
        detail: 'bio must have at most 300 characters',
        errors: [
          { field: 'bio', code: 'TOO_LONG' },
          { field: 'region', code: 'UNSUPPORTED_VALUE' },
        ],
      }),
    )

    await expect(editProfile('"4"', {})).resolves.toEqual({
      kind: 'invalid',
      fieldErrors: [
        { field: 'bio', code: 'TOO_LONG' },
        { field: 'region', code: 'UNSUPPORTED_VALUE' },
      ],
    })
  })

  it('does not read the field from the English detail, which is for developers', async () => {
    fetchMock.mockResolvedValue(problemResponse(400, { detail: 'bio must have at most 300 characters' }))

    await expect(editProfile('"4"', {})).resolves.toEqual({ kind: 'invalid', fieldErrors: [] })
  })

  it.each([
    ['no detail', undefined, undefined],
    ['errors out of the format', 'bio is too long', 'bio'],
  ])('reports a 400 with %s without any field', async (_case, detail, errors) => {
    fetchMock.mockResolvedValue(problemResponse(400, { detail, errors }))

    await expect(editProfile('"4"', {})).resolves.toEqual({ kind: 'invalid', fieldErrors: [] })
  })

  it('reports an expired session on 401', async () => {
    fetchMock.mockResolvedValue(problemResponse(401))

    await expect(editProfile('"4"', { bio: 'Oi' })).resolves.toEqual({ kind: 'signedOut' })
  })

  it.each([403, 415, 428, 500, 503])('reports a failure on %i', async (status) => {
    fetchMock.mockResolvedValue(problemResponse(status))

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

describe('profile fields', () => {
  it('lists the fields of the form in screen order', () => {
    expect(PROFILE_FIELDS).toEqual(['displayName', 'birthDate', 'region', 'bio'])
  })

  it.each(PROFILE_FIELDS)('recognizes %s', (field) => {
    expect(isProfileField(field)).toBe(true)
  })

  it.each(['', 'email', 'DisplayName', 'bio ', '__proto__', 'complete'])('does not recognize %j', (name) => {
    expect(isProfileField(name)).toBe(false)
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

  it('lists exactly the fields the edit accepts', () => {
    expectTypeOf<(typeof PROFILE_FIELDS)[number]>().toEqualTypeOf<ProfileField>()
    expectTypeOf<ProfileField>().toEqualTypeOf<keyof EditProfileRequest>()
  })

  it('knows the same regions the edit accepts', () => {
    expectTypeOf<Region>().toEqualTypeOf<NonNullable<EditProfileRequest['region']>>()
  })
})
