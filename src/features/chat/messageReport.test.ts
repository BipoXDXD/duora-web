import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { ChatMessageReportResponse, ReportChatMessageRequest } from '../../shared/api/contract.ts'
import {
  REPORT_REASONS,
  reportMessage,
  type ReportBody,
  type ReportedWire,
  type ReportReason,
} from './messageReport.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const PARTNER_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7e'
const REPORT = {
  id: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7f',
  reportedAccountId: PARTNER_ID,
  reason: 'HARASSMENT',
  description: null,
  status: 'OPEN',
  createdAt: '2026-10-10T23:10:00Z',
}
const REPORT_PATH = `/api/events/${EVENT_ID}/rounds/2/chat/messages/7:report`

function json(body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

function problem(status: number, body: unknown = {}, headers: Readonly<Record<string, string>> = {}): Response {
  return new Response(JSON.stringify({ title: 'Erro', status, ...(body as object) }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  })
}

function lastCall() {
  const [path, init] = fetchMock.mock.calls.at(-1) ?? []
  return { path, method: init?.method, body: init?.body, headers: new Headers(init?.headers) }
}

describe('reportMessage', () => {
  it('posts the reason and the description to the report action of the message, with the CSRF header', async () => {
    document.cookie = 'XSRF-TOKEN=token-1; path=/'
    fetchMock.mockResolvedValue(json(REPORT, 201, { Location: `/api/reports/${REPORT.id}` }))

    await reportMessage(EVENT_ID, 2, 7, { reason: 'OTHER', description: 'Pediu meu endereço.' })

    expect(lastCall()).toMatchObject({ path: REPORT_PATH, method: 'POST' })
    expect(JSON.parse(String(lastCall().body))).toEqual({ reason: 'OTHER', description: 'Pediu meu endereço.' })
    expect(lastCall().headers.get('X-XSRF-TOKEN')).toBe('token-1')
  })

  it('sends a missing description as null', async () => {
    fetchMock.mockResolvedValue(json(REPORT, 201))

    await reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })

    expect(JSON.parse(String(lastCall().body))).toEqual({ reason: 'HARASSMENT', description: null })
  })

  it('returns the reported account on 201, to block it afterwards', async () => {
    fetchMock.mockResolvedValue(json(REPORT, 201))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).resolves.toEqual({
      kind: 'reported',
      reportedAccountId: PARTNER_ID,
    })
  })

  it('returns the field errors of a 400', async () => {
    fetchMock.mockResolvedValue(problem(400, { errors: [{ field: 'description', code: 'REQUIRED' }] }))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'OTHER', description: null })).resolves.toEqual({
      kind: 'invalid',
      fieldErrors: [{ field: 'description', code: 'REQUIRED' }],
    })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [404, { kind: 'notFound' }],
    [403, { kind: 'failed' }],
    [500, { kind: 'failed' }],
  ] as const)('reads %s as %o', async (status, result) => {
    fetchMock.mockResolvedValue(problem(status))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).resolves.toEqual(result)
  })

  it('reads 429 as the daily quota used up, with the seconds of the Retry-After', async () => {
    fetchMock.mockResolvedValue(problem(429, {}, { 'Retry-After': '7200' }))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).resolves.toEqual({
      kind: 'quotaExhausted',
      retryAfterSeconds: 7200,
    })
  })

  it('reads 503 as reports unavailable for now, with the seconds of the Retry-After', async () => {
    fetchMock.mockResolvedValue(problem(503, {}, { 'Retry-After': '1' }))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).resolves.toEqual({
      kind: 'unavailable',
      retryAfterSeconds: 1,
    })
  })

  it('fails without crashing when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).resolves.toEqual({
      kind: 'failed',
    })
  })

  it.each([
    ['a reported account that is not a UUID', { ...REPORT, reportedAccountId: '../me' }],
    ['no reported account', { ...REPORT, reportedAccountId: undefined }],
  ])('fails on a 201 with %s', async (_case, body) => {
    fetchMock.mockResolvedValue(json(body, 201))

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).resolves.toEqual({
      kind: 'failed',
    })
  })

  it('lets a bug in the code go up', async () => {
    fetchMock.mockImplementation(() => {
      throw new RangeError('bug')
    })

    await expect(reportMessage(EVENT_ID, 2, 7, { reason: 'HARASSMENT', description: null })).rejects.toBeInstanceOf(
      RangeError,
    )
  })
})

describe('contract with the generated API types', () => {
  it('knows every reason the spec declares, and no other', () => {
    expectTypeOf<(typeof REPORT_REASONS)[number]>().toEqualTypeOf<ReportChatMessageRequest['reason']>()
    expectTypeOf<ReportReason>().toEqualTypeOf<ReportChatMessageRequest['reason']>()
    expect(new Set(REPORT_REASONS).size).toBe(REPORT_REASONS.length)
  })

  it('sends the body the spec declares', () => {
    expectTypeOf<ReportBody>().toExtend<ReportChatMessageRequest>()
  })

  it('reads the reported account the way the spec declares it', () => {
    expectTypeOf<ChatMessageReportResponse>().toExtend<ReportedWire>()
  })
})
