import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod/mini'
import { ApiError, InvalidResponseError, isApiFailure, readJsonBody, sendApiRequest } from './http.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
})

afterEach(() => {
  clearCookie('XSRF-TOKEN')
})

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`
}

function sentInit(): RequestInit {
  const call = fetchMock.mock.calls[0]
  if (call === undefined) {
    throw new Error('fetch não foi chamado')
  }
  return call[1] ?? {}
}

function sentHeaders(): Headers {
  return new Headers(sentInit().headers)
}

describe('sendApiRequest', () => {
  it('sends the CSRF token from the XSRF-TOKEN cookie on a POST', async () => {
    setCookie('XSRF-TOKEN', 'abc-123')

    await sendApiRequest({ method: 'POST', path: '/api/things' })

    expect(sentHeaders().get('X-XSRF-TOKEN')).toBe('abc-123')
  })

  it.each(['PUT', 'PATCH', 'DELETE'] as const)('sends the CSRF token on a %s', async (method) => {
    setCookie('XSRF-TOKEN', 'abc-123')

    await sendApiRequest({ method, path: '/api/things/1' })

    expect(sentHeaders().get('X-XSRF-TOKEN')).toBe('abc-123')
  })

  it('decodes a URL-encoded CSRF cookie', async () => {
    setCookie('XSRF-TOKEN', 'a%2Fb%3D')

    await sendApiRequest({ method: 'POST', path: '/api/things' })

    expect(sentHeaders().get('X-XSRF-TOKEN')).toBe('a/b=')
  })

  it('does not send the CSRF token on a GET', async () => {
    setCookie('XSRF-TOKEN', 'abc-123')

    await sendApiRequest({ method: 'GET', path: '/api/things' })

    expect(sentHeaders().has('X-XSRF-TOKEN')).toBe(false)
  })

  it('omits the CSRF header when there is no XSRF-TOKEN cookie', async () => {
    setCookie('OTHER-XSRF-TOKEN', 'not-this-one')

    await sendApiRequest({ method: 'POST', path: '/api/things' })

    expect(sentHeaders().has('X-XSRF-TOKEN')).toBe(false)
    clearCookie('OTHER-XSRF-TOKEN')
  })

  it('sends cookies only to the same origin', async () => {
    await sendApiRequest({ method: 'GET', path: '/api/things' })

    expect(sentInit().credentials).toBe('same-origin')
  })

  it('serializes the body as JSON', async () => {
    await sendApiRequest({ method: 'POST', path: '/api/waitlist', body: { email: 'ana@example.com' } })

    expect(fetchMock).toHaveBeenCalledWith('/api/waitlist', expect.objectContaining({ method: 'POST' }))
    expect(sentInit().body).toBe('{"email":"ana@example.com"}')
    expect(sentHeaders().get('Content-Type')).toBe('application/json')
  })

  it('sends neither body nor Content-Type without a body', async () => {
    await sendApiRequest({ method: 'POST', path: '/api/things' })

    expect(sentInit().body).toBeUndefined()
    expect(sentHeaders().has('Content-Type')).toBe(false)
  })

  it('returns the response when the status is 2xx', async () => {
    const response = new Response(null, { status: 202 })
    fetchMock.mockResolvedValue(response)

    await expect(sendApiRequest({ method: 'POST', path: '/api/waitlist' })).resolves.toBe(response)
  })

  it('throws ApiError with the status when the response is not 2xx', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }))

    const error = await sendApiRequest({ method: 'POST', path: '/api/waitlist' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, retryAfterSeconds: null })
  })

  it('reads Retry-After in seconds from the error response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '1800' } }))

    const error = await sendApiRequest({ method: 'POST', path: '/api/waitlist' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 1800 })
  })

  it.each(['', 'soon', '-5', '1.5', 'Wed, 21 Oct 2026 07:28:00 GMT'])(
    'ignores a Retry-After that is not a whole number of seconds: %j',
    async (retryAfter) => {
      fetchMock.mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': retryAfter } }))

      const error = await sendApiRequest({ method: 'POST', path: '/api/waitlist' }).catch((e: unknown) => e)

      expect(error).toMatchObject({ status: 429, retryAfterSeconds: null })
    },
  )

  it('lets a network failure propagate', async () => {
    const failure = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(failure)

    await expect(sendApiRequest({ method: 'GET', path: '/api/things' })).rejects.toBe(failure)
  })
})

const greetingSchema = z.object({ greeting: z.string() })

function jsonResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('readJsonBody', () => {
  it('returns the body parsed by the schema, without the fields the schema does not know', async () => {
    const body = await readJsonBody(jsonResponse('{"greeting":"oi","secret":"x"}'), greetingSchema)

    expect(body).toEqual({ greeting: 'oi' })
  })

  it.each([
    ['a field of the wrong type', '{"greeting":42}'],
    ['a missing field', '{}'],
    ['null', 'null'],
    ['an array', '[]'],
  ])('rejects a body with %s as an invalid response', async (_case, body) => {
    await expect(readJsonBody(jsonResponse(body), greetingSchema)).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('rejects a body that is not JSON as an invalid response', async () => {
    await expect(readJsonBody(jsonResponse('<html>'), greetingSchema)).rejects.toBeInstanceOf(InvalidResponseError)
  })

  it('rejects an empty body as an invalid response', async () => {
    await expect(readJsonBody(new Response(null, { status: 200 }), greetingSchema)).rejects.toBeInstanceOf(
      InvalidResponseError,
    )
  })
})

describe('isApiFailure', () => {
  it.each([
    ['an error status', new ApiError(500, null)],
    ['a network failure', new TypeError('Failed to fetch')],
    ['a body out of the contract', new InvalidResponseError()],
  ])('counts %s as a failure of the API call', (_case, error) => {
    expect(isApiFailure(error)).toBe(true)
  })

  it.each([
    ['a bug', new RangeError('bug')],
    ['something that is not an error', 'oops'],
  ])('does not count %s, so it is not hidden as a failed call', (_case, error) => {
    expect(isApiFailure(error)).toBe(false)
  })
})
