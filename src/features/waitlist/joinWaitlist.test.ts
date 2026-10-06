import { beforeEach, describe, expect, it, vi } from 'vitest'
import { joinWaitlist } from './joinWaitlist.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

describe('joinWaitlist', () => {
  it('posts the e-mail to /api/waitlist', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }))

    await joinWaitlist('ana@example.com')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0] ?? []
    expect(path).toBe('/api/waitlist')
    expect(init).toMatchObject({ method: 'POST', body: '{"email":"ana@example.com"}' })
  })

  it('reports joined on 202', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }))

    await expect(joinWaitlist('ana@example.com')).resolves.toEqual({ kind: 'joined' })
  })

  it('reports an invalid e-mail on 400', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }))

    await expect(joinWaitlist('ana@')).resolves.toEqual({ kind: 'invalidEmail' })
  })

  it('reports too many attempts with the wait on 429', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '1800' } }))

    await expect(joinWaitlist('ana@example.com')).resolves.toEqual({
      kind: 'tooManyAttempts',
      retryAfterSeconds: 1800,
    })
  })

  it.each([401, 403, 404, 500, 503])('reports a failure on %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    await expect(joinWaitlist('ana@example.com')).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a failure when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(joinWaitlist('ana@example.com')).resolves.toEqual({ kind: 'failed' })
  })

  it('does not hide a TypeError from our own code as a network failure', async () => {
    const response = new Response(null, { status: 400 })
    Object.defineProperty(response, 'headers', { value: undefined })
    fetchMock.mockResolvedValue(response)

    await expect(joinWaitlist('ana@example.com')).rejects.toBeInstanceOf(TypeError)
  })

  it('does not hide errors that are not from the network or the API', async () => {
    const bug = new RangeError('bug')
    fetchMock.mockRejectedValue(bug)

    await expect(joinWaitlist('ana@example.com')).rejects.toBe(bug)
  })
})
