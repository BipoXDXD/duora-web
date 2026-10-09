import { beforeEach, describe, expect, it, vi } from 'vitest'
import { problemResponse } from '../../test/responses.ts'
import { blockReported } from './blockReported.ts'

const ACCOUNT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

describe('blockReported', () => {
  it('blocks the reported account', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(blockReported(ACCOUNT_ID)).resolves.toBe('blocked')
    expect(fetchMock).toHaveBeenCalledWith(`/api/accounts/${ACCOUNT_ID}:block`, expect.objectContaining({ method: 'POST' }))
  })

  it('reads a 401 as a session that ended, which signing in again solves', async () => {
    fetchMock.mockResolvedValue(problemResponse(401))

    await expect(blockReported(ACCOUNT_ID)).resolves.toBe('signedOut')
  })

  it.each([
    ['another error status', () => Promise.resolve(problemResponse(503))],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('reads %s as a block that failed and can be tried again', async (_case, answer) => {
    fetchMock.mockImplementation(answer)

    await expect(blockReported(ACCOUNT_ID)).resolves.toBe('failed')
  })

  it('lets a bug through instead of hiding it as a failed block', async () => {
    const bug = new RangeError('bug')
    fetchMock.mockRejectedValue(bug)

    await expect(blockReported(ACCOUNT_ID)).rejects.toBe(bug)
  })
})
