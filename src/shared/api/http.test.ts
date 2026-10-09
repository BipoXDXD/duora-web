import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { z } from 'zod/mini'
import type { FieldErrorWire, RefusalProblemDetailWire } from './contract.ts'
import {
  ApiError,
  FIELD_ERROR_CODES,
  type FieldError,
  hasStatus,
  InvalidResponseError,
  isApiFailure,
  isBug,
  type KnownFieldErrorCode,
  type KnownRefusalReason,
  NetworkError,
  readJsonBody,
  REFUSAL_REASONS,
  type RefusalReason,
  sendApiRequest,
} from './http.ts'

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

  it('sends If-Match when the request carries the version it read', async () => {
    await sendApiRequest({ method: 'PATCH', path: '/api/me/profile', ifMatch: '"3"', body: {} })

    expect(sentHeaders().get('If-Match')).toBe('"3"')
  })

  it('sends no If-Match when the request has no version', async () => {
    await sendApiRequest({ method: 'PATCH', path: '/api/me/profile', body: {} })

    expect(sentHeaders().has('If-Match')).toBe(false)
  })

  it('sends Idempotency-Key when the request carries one', async () => {
    const attemptId = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7c'
    await sendApiRequest({ method: 'POST', path: '/api/x', idempotencyKey: attemptId, body: {} })

    expect(sentHeaders().get('Idempotency-Key')).toBe(attemptId)
  })

  it('sends no Idempotency-Key when the request has none', async () => {
    await sendApiRequest({ method: 'POST', path: '/api/x', body: {} })

    expect(sentHeaders().has('Idempotency-Key')).toBe(false)
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

  it('keeps the detail of a ProblemDetail error body', async () => {
    fetchMock.mockResolvedValue(problemResponse(400, '{"title":"Bad Request","status":400,"detail":"bio is too long"}'))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 400, problemDetail: 'bio is too long' })
  })

  it.each([
    ['without a body', null],
    ['with a body that is not JSON', '<html>erro</html>'],
    ['without a detail', '{"title":"Bad Request","status":400}'],
    ['with a detail that is not text', '{"title":"Bad Request","status":400,"detail":42}'],
  ])('has no detail for an error %s', async (_case, body) => {
    fetchMock.mockResolvedValue(problemResponse(400, body))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, problemDetail: null })
  })

  it('keeps the field errors of a validation problem, in the order the API sent them', async () => {
    const body = {
      title: 'Bad Request',
      status: 400,
      errors: [
        { field: 'bio', code: 'TOO_LONG' },
        { field: 'displayName', code: 'FORBIDDEN_CHARACTER' },
      ],
    }
    fetchMock.mockResolvedValue(problemResponse(400, JSON.stringify(body)))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toMatchObject({
      status: 400,
      fieldErrors: [
        { field: 'bio', code: 'TOO_LONG' },
        { field: 'displayName', code: 'FORBIDDEN_CHARACTER' },
      ],
    })
  })

  it('reads an error without a field as an error of the whole body', async () => {
    fetchMock.mockResolvedValue(problemResponse(400, '{"errors":[{"code":"MALFORMED_BODY"}]}'))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ fieldErrors: [{ field: null, code: 'MALFORMED_BODY' }] })
  })

  it('reads a code the front does not know as UNRECOGNIZED, keeping the other errors', async () => {
    const body = '{"errors":[{"field":"bio","code":"TOO_SPICY"},{"field":"region","code":"UNSUPPORTED_VALUE"}]}'
    fetchMock.mockResolvedValue(problemResponse(400, body))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toMatchObject({
      fieldErrors: [
        { field: 'bio', code: 'UNRECOGNIZED' },
        { field: 'region', code: 'UNSUPPORTED_VALUE' },
      ],
    })
  })

  it.each([
    ['without a body', null],
    ['with a body that is not JSON', '<html>erro</html>'],
    ['without errors', '{"title":"Bad Request","status":400}'],
    ['with an empty errors list', '{"errors":[]}'],
    ['with errors that is not a list', '{"errors":"bio"}'],
    ['with errors that is null', '{"errors":null}'],
    ['with an error that has no code', '{"errors":[{"field":"bio"}]}'],
    ['with a code that is not text', '{"errors":[{"field":"bio","code":7}]}'],
    ['with a field that is not text', '{"errors":[{"field":7,"code":"TOO_LONG"}]}'],
    ['with an item that is not an object', '{"errors":["bio"]}'],
  ])('has no field errors for an error %s', async (_case, body) => {
    fetchMock.mockResolvedValue(problemResponse(400, body))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, fieldErrors: [] })
  })

  it('keeps the detail when the errors are out of the format', async () => {
    fetchMock.mockResolvedValue(problemResponse(400, '{"detail":"bio is too long","errors":"bio"}'))

    const error = await sendApiRequest({ method: 'PATCH', path: '/api/me/profile' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ problemDetail: 'bio is too long', fieldErrors: [] })
  })

  it('has no field errors when the error has no problem body at all', () => {
    expect(new ApiError(500, null).fieldErrors).toEqual([])
  })

  it.each(REFUSAL_REASONS)('keeps the refusal reason %s of a business rule refusal', async (reason) => {
    fetchMock.mockResolvedValue(problemResponse(409, JSON.stringify({ title: 'Conflict', status: 409, reason })))

    const error = await sendApiRequest({ method: 'PUT', path: '/api/events/x/registration' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 409, refusalReason: reason })
  })

  it('reads a refusal reason the front does not know as UNRECOGNIZED', async () => {
    fetchMock.mockResolvedValue(problemResponse(409, '{"status":409,"reason":"EVENT_ON_FIRE"}'))

    const error = await sendApiRequest({ method: 'PUT', path: '/api/events/x/registration' }).catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 409, refusalReason: 'UNRECOGNIZED' })
  })

  it('keeps the detail and the field errors next to a refusal reason', async () => {
    const body = '{"detail":"event is full","reason":"EVENT_FULL","errors":[{"field":"bio","code":"TOO_LONG"}]}'
    fetchMock.mockResolvedValue(problemResponse(409, body))

    const error = await sendApiRequest({ method: 'PUT', path: '/api/events/x/registration' }).catch((e: unknown) => e)

    expect(error).toMatchObject({
      problemDetail: 'event is full',
      refusalReason: 'EVENT_FULL',
      fieldErrors: [{ field: 'bio', code: 'TOO_LONG' }],
    })
  })

  it.each([
    ['without a body', null],
    ['with a body that is not JSON', '<html>erro</html>'],
    ['without a reason', '{"title":"Conflict","status":409}'],
    ['with a reason that is null', '{"reason":null}'],
    ['with a reason that is not text', '{"reason":7}'],
    ['with a reason that is a list', '{"reason":["EVENT_FULL"]}'],
  ])('has no refusal reason for an error %s', async (_case, body) => {
    fetchMock.mockResolvedValue(problemResponse(409, body))

    const error = await sendApiRequest({ method: 'PUT', path: '/api/events/x/registration' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, refusalReason: null })
  })

  it('has no refusal reason when the error has no problem body at all', () => {
    expect(new ApiError(409, null).refusalReason).toBeNull()
  })

  it('turns a fetch rejection into a NetworkError that keeps the cause', async () => {
    const failure = new TypeError('Failed to fetch')
    fetchMock.mockRejectedValue(failure)

    const error = await sendApiRequest({ method: 'GET', path: '/api/things' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NetworkError)
    expect(error).toMatchObject({ cause: failure })
  })

  it('lets a rejection that is not from the network propagate unchanged', async () => {
    const bug = new RangeError('bug')
    fetchMock.mockRejectedValue(bug)

    await expect(sendApiRequest({ method: 'GET', path: '/api/things' })).rejects.toBe(bug)
  })

  it('lets a TypeError from our own code after the fetch propagate unchanged', async () => {
    const response = new Response(null, { status: 500 })
    Object.defineProperty(response, 'headers', { value: undefined })
    fetchMock.mockResolvedValue(response)

    await expect(sendApiRequest({ method: 'GET', path: '/api/things' })).rejects.toBeInstanceOf(TypeError)
  })
})

function problemResponse(status: number, body: string | null): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/problem+json' } })
}

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

  it('lets a TypeError from reading the body propagate, since it is not a body out of the contract', async () => {
    const response = jsonResponse('{"greeting":"oi"}')
    await response.text()

    await expect(readJsonBody(response, greetingSchema)).rejects.toBeInstanceOf(TypeError)
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
    ['a network failure', new NetworkError({ cause: new TypeError('Failed to fetch') })],
    ['a body out of the contract', new InvalidResponseError()],
  ])('counts %s as a failure of the API call', (_case, error) => {
    expect(isApiFailure(error)).toBe(true)
  })

  it.each([
    ['a bug', new RangeError('bug')],
    ['a TypeError from our own code', new TypeError('Cannot read properties of undefined')],
    ['something that is not an error', 'oops'],
  ])('does not count %s, so it is not hidden as a failed call', (_case, error) => {
    expect(isApiFailure(error)).toBe(false)
  })
})

describe('hasStatus', () => {
  it('recognizes an API error with that status', () => {
    expect(hasStatus(new ApiError(404, null), 404)).toBe(true)
  })

  it.each([
    ['an API error with another status', new ApiError(403, null)],
    ['a network failure', new NetworkError({ cause: new TypeError('Failed to fetch') })],
    ['a bug', new RangeError('404')],
  ])('does not recognize %s', (_case, error) => {
    expect(hasStatus(error, 404)).toBe(false)
  })
})

describe('isBug', () => {
  it('does not count a failed API call as a bug, so it becomes a state on the screen', () => {
    expect(isBug(new ApiError(503, null))).toBe(false)
  })

  it('counts any other error as a bug, so it reaches the React error boundary', () => {
    expect(isBug(new RangeError('bug'))).toBe(true)
  })
})

describe('contract with the generated API types', () => {
  // Só compila se os `code` que o front conhece forem exatamente os da spec. Se a API acrescentar ou tirar
  // um, `npm run api:types` muda `schema.d.ts` e este teste deixa de compilar.
  it('knows the same field error codes the spec declares', () => {
    expectTypeOf<KnownFieldErrorCode>().toEqualTypeOf<FieldErrorWire['code']>()
    expect(new Set(FIELD_ERROR_CODES).size).toBe(FIELD_ERROR_CODES.length)
  })

  it('knows the same refusal reasons the spec declares', () => {
    expectTypeOf<KnownRefusalReason>().toEqualTypeOf<NonNullable<RefusalProblemDetailWire['reason']>>()
    expect(new Set(REFUSAL_REASONS).size).toBe(REFUSAL_REASONS.length)
  })

  it('reads the reason as one of the known ones, UNRECOGNIZED or absent', () => {
    expectTypeOf<ApiError['refusalReason']>().toEqualTypeOf<RefusalReason | null>()
    expectTypeOf<RefusalReason>().toEqualTypeOf<KnownRefusalReason | 'UNRECOGNIZED'>()
  })

  it('names the field the way the spec does, with null instead of absent', () => {
    expectTypeOf<FieldError['field']>().toEqualTypeOf<NonNullable<FieldErrorWire['field']> | null>()
  })
})
