import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type {
  ChatMessageResponse,
  ChatMessagesResponse,
  ChatResponse,
  SendMessageRequest,
} from '../../shared/api/contract.ts'
import { ApiError, InvalidResponseError } from '../../shared/api/http.ts'
import { jsonResponse } from '../../test/responses.ts'
import {
  fetchChatAccess,
  fetchMessagesAfter,
  sendMessage,
  type ChatAccessWire,
  type ChatMessage,
  type MessagePageWire,
  type MessageWire,
  type SendBody,
} from './chat.ts'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b'
const CHAT = `/api/events/${EVENT_ID}/rounds/2/chat`
const KEY = '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7c'
const MESSAGE = { seq: 3, fromMe: false, text: 'Oi!\nTudo bem?', sentAt: '2026-10-10T23:05:00Z' }
const READ_MESSAGE: ChatMessage = { seq: 3, fromMe: false, text: 'Oi!\nTudo bem?', sentAt: new Date(MESSAGE.sentAt) }

function lastCall() {
  const [path, init] = fetchMock.mock.calls.at(-1) ?? []
  return { path, method: init?.method, body: init?.body, headers: new Headers(init?.headers) }
}

describe('fetchChatAccess', () => {
  it.each([
    [true, 'open'],
    [false, 'closed'],
  ] as const)('reads open=%s as %s', async (open, kind) => {
    fetchMock.mockResolvedValue(jsonResponse({ chatId: KEY, open, lastSeq: 4 }))

    await expect(fetchChatAccess(EVENT_ID, 2)).resolves.toEqual({ kind })
    expect(lastCall()).toMatchObject({ path: CHAT, method: 'GET' })
  })

  it('reports that there is no chat for someone who did not form a pair, on 404', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchChatAccess(EVENT_ID, 2)).resolves.toEqual({ kind: 'notPaired' })
  })

  it('fails with the API status on another error', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))

    await expect(fetchChatAccess(EVENT_ID, 2)).rejects.toBeInstanceOf(ApiError)
  })

  it('fails when open is not a boolean', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ chatId: KEY, open: 'true', lastSeq: 4 }))

    await expect(fetchChatAccess(EVENT_ID, 2)).rejects.toBeInstanceOf(InvalidResponseError)
  })
})

describe('fetchMessagesAfter', () => {
  it('asks for the messages after the cursor, in the largest page the API gives', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [MESSAGE], nextAfterSeq: null }))

    await expect(fetchMessagesAfter(EVENT_ID, 2, 2)).resolves.toEqual({ items: [READ_MESSAGE], hasMore: false })
    expect(lastCall()).toMatchObject({ path: `${CHAT}/messages?afterSeq=2&maxPageSize=100`, method: 'GET' })
  })

  it('says there is more when the API gives the next cursor', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [MESSAGE], nextAfterSeq: 3 }))

    await expect(fetchMessagesAfter(EVENT_ID, 2, 2)).resolves.toEqual({ items: [READ_MESSAGE], hasMore: true })
  })

  it('reads an empty page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], nextAfterSeq: null }))

    await expect(fetchMessagesAfter(EVENT_ID, 2, 0)).resolves.toEqual({ items: [], hasMore: false })
  })

  it('reports no chat on 404', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(fetchMessagesAfter(EVENT_ID, 2, 0)).resolves.toBeNull()
  })

  it('fails with the Retry-After of a busy API', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503, headers: { 'Retry-After': '4' } }))

    await expect(fetchMessagesAfter(EVENT_ID, 2, 0)).rejects.toMatchObject({ status: 503, retryAfterSeconds: 4 })
  })

  it.each([
    ['a position that is not a whole number', { ...MESSAGE, seq: 1.5 }],
    ['a position below 1', { ...MESSAGE, seq: 0 }],
    ['a date without a time zone', { ...MESSAGE, sentAt: '2026-10-10T23:05:00' }],
    ['text missing', { seq: 3, fromMe: false, sentAt: MESSAGE.sentAt }],
  ])('fails on a message with %s', async (_case, message) => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [message], nextAfterSeq: null }))

    await expect(fetchMessagesAfter(EVENT_ID, 2, 0)).rejects.toBeInstanceOf(InvalidResponseError)
  })
})

describe('sendMessage', () => {
  it('sends the text with POST, the key and the CSRF header', async () => {
    document.cookie = 'XSRF-TOKEN=token-1; path=/'
    fetchMock.mockResolvedValue(jsonResponse({ ...MESSAGE, fromMe: true }, 201))

    await sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })

    const call = lastCall()
    expect(call).toMatchObject({ path: `${CHAT}/messages`, method: 'POST', body: '{"text":"Oi!"}' })
    expect(call.headers.get('Idempotency-Key')).toBe(KEY)
    expect(call.headers.get('X-XSRF-TOKEN')).toBe('token-1')
    document.cookie = 'XSRF-TOKEN=; path=/; max-age=0'
  })

  it.each([201, 200])('reports the recorded message on %i', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ ...MESSAGE, fromMe: true }, status))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).resolves.toEqual({
      kind: 'sent',
      message: { ...READ_MESSAGE, fromMe: true },
    })
  })

  it.each([
    ['CHAT_CLOSED', { kind: 'closed' }],
    ['IDEMPOTENCY_KEY_REUSED', { kind: 'keyReused' }],
    ['SOMETHING_NEW', { kind: 'failed' }],
  ])('turns a 409 with the reason %s into %o', async (reason, result) => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Conflict', status: 409, reason }, 409))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).resolves.toEqual(result)
  })

  it('gives the field errors of a 400', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Bad Request', status: 400, errors: [{ field: 'text', code: 'TOO_LONG' }] }, 400))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'x' })).resolves.toEqual({
      kind: 'invalid',
      fieldErrors: [{ field: 'text', code: 'TOO_LONG' }],
    })
  })

  it.each([
    [401, { kind: 'signedOut' }],
    [404, { kind: 'notPaired' }],
    [409, { kind: 'failed' }],
    [500, { kind: 'failed' }],
  ])('turns %i into %o', async (status, result) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).resolves.toEqual(result)
  })

  it.each([429, 503])('asks to wait the Retry-After on %i', async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status, headers: { 'Retry-After': '7' } }))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).resolves.toEqual({
      kind: 'busy',
      retryAfterSeconds: 7,
    })
  })

  it('reports a failure when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).resolves.toEqual({ kind: 'failed' })
  })

  it('reports a failure on a body outside the contract', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...MESSAGE, seq: 'três' }, 201))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).resolves.toEqual({ kind: 'failed' })
  })

  it('lets a bug in our own code go up', async () => {
    fetchMock.mockRejectedValue(new RangeError('bug'))

    await expect(sendMessage(EVENT_ID, 2, { key: KEY, text: 'Oi!' })).rejects.toBeInstanceOf(RangeError)
  })
})

describe('contract with the generated API types', () => {
  it('reads the chat, the messages and a page the way the spec declares them', () => {
    expectTypeOf<ChatAccessWire>().toEqualTypeOf<ChatResponse>()
    expectTypeOf<MessageWire>().toEqualTypeOf<ChatMessageResponse>()
    expectTypeOf<MessagePageWire>().toEqualTypeOf<ChatMessagesResponse>()
  })

  it('sends the body the spec declares', () => {
    expectTypeOf<SendBody>().toEqualTypeOf<SendMessageRequest>()
  })
})
