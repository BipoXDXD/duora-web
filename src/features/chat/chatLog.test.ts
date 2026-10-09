import { describe, expect, it } from 'vitest'
import type { ChatMessage } from './chat.ts'
import { chatLogReducer, INITIAL_CHAT_LOG, type ChatLog, type Received } from './chatLog.ts'

const SENT_AT = new Date('2026-10-10T23:05:00Z')

function message(seq: number, fromMe = false, text = `mensagem ${seq}`): ChatMessage {
  return { seq, fromMe, text, sentAt: SENT_AT }
}

function received(seq: number): Received {
  return { key: `seq-${seq}`, message: message(seq) }
}

function ready(overrides: Partial<Extract<ChatLog, { kind: 'ready' }>> = {}): ChatLog {
  return { kind: 'ready', open: true, messages: [], outgoing: [], ...overrides }
}

function seqsOf(log: ChatLog): number[] {
  return log.kind === 'ready' ? log.messages.map(({ message: { seq } }) => seq) : []
}

describe('chatLogReducer', () => {
  describe('access', () => {
    it.each([
      ['open', true],
      ['closed', false],
    ] as const)('starts an empty %s chat', (kind, open) => {
      expect(chatLogReducer(INITIAL_CHAT_LOG, { type: 'accessRead', access: { kind } })).toEqual(ready({ open }))
    })

    it('says there is no chat for someone who did not form a pair', () => {
      const log = chatLogReducer(INITIAL_CHAT_LOG, { type: 'accessRead', access: { kind: 'notPaired' } })

      expect(log).toEqual({ kind: 'notPaired' })
    })

    it('closes a chat that was open, keeping its messages', () => {
      const log = chatLogReducer(ready({ messages: [received(1)] }), {
        type: 'accessRead',
        access: { kind: 'closed' },
      })

      expect(log).toEqual(ready({ open: false, messages: [received(1)] }))
    })
  })

  describe('pages', () => {
    it('keeps the messages in the order of their position, whatever order they arrive in', () => {
      const log = chatLogReducer(ready({ messages: [received(2)] }), {
        type: 'pageReceived',
        items: [message(3), message(1)],
      })

      expect(seqsOf(log)).toEqual([1, 2, 3])
    })

    it('keeps one copy of a message that arrives twice, the one it had', () => {
      const own = { key: 'key-1', message: message(2, true) }
      const log = chatLogReducer(ready({ messages: [received(1), own] }), {
        type: 'pageReceived',
        items: [message(1), message(2, true), message(3)],
      })

      expect(log).toEqual(ready({ messages: [received(1), own, received(3)] }))
    })

    it('ignores a page before the chat was read', () => {
      expect(chatLogReducer(INITIAL_CHAT_LOG, { type: 'pageReceived', items: [message(1)] })).toBe(INITIAL_CHAT_LOG)
    })
  })

  describe('sending', () => {
    const sending = { key: 'key-1', text: 'Oi!', status: { kind: 'sending' } } as const

    it('shows the text as pending while it is sent', () => {
      const log = chatLogReducer(ready(), { type: 'sendStarted', outgoing: { key: 'key-1', text: 'Oi!' } })

      expect(log).toEqual(ready({ outgoing: [sending] }))
    })

    it('marks a failed text as pending again when it is retried, in the same place', () => {
      const failed = { ...sending, status: { kind: 'failed', retryAfterSeconds: null } } as const
      const other = { key: 'key-2', text: 'E aí?', status: { kind: 'sending' } } as const
      const log = chatLogReducer(ready({ outgoing: [failed, other] }), {
        type: 'sendStarted',
        outgoing: { key: 'key-1', text: 'Oi!' },
      })

      expect(log).toEqual(ready({ outgoing: [sending, other] }))
    })

    it('replaces the pending text with the message the API recorded, under the same key', () => {
      const log = chatLogReducer(ready({ messages: [received(1)], outgoing: [sending] }), {
        type: 'sendSettled',
        key: 'key-1',
        result: { kind: 'sent', message: message(2, true, 'Oi!') },
      })

      expect(log).toEqual(ready({ messages: [received(1), { key: 'key-1', message: message(2, true, 'Oi!') }] }))
    })

    it('keeps the copy that a read brought first, without repeating it', () => {
      const log = chatLogReducer(ready({ messages: [received(2)], outgoing: [sending] }), {
        type: 'sendSettled',
        key: 'key-1',
        result: { kind: 'sent', message: message(2, true, 'Oi!') },
      })

      expect(log).toEqual(ready({ messages: [received(2)] }))
    })

    it.each([
      ['busy', { kind: 'busy', retryAfterSeconds: 5 }, { kind: 'failed', retryAfterSeconds: 5 }],
      ['failed', { kind: 'failed' }, { kind: 'failed', retryAfterSeconds: null }],
      ['signedOut', { kind: 'signedOut' }, { kind: 'signedOut' }],
      ['keyReused', { kind: 'keyReused' }, { kind: 'notSent' }],
    ] as const)('marks the text after %s', (_case, result, status) => {
      const log = chatLogReducer(ready({ outgoing: [sending] }), { type: 'sendSettled', key: 'key-1', result })

      expect(log).toEqual(ready({ outgoing: [{ ...sending, status }] }))
    })

    it('closes the chat and marks the text as not sent on CHAT_CLOSED', () => {
      const log = chatLogReducer(ready({ outgoing: [sending] }), {
        type: 'sendSettled',
        key: 'key-1',
        result: { kind: 'closed' },
      })

      expect(log).toEqual(ready({ open: false, outgoing: [{ ...sending, status: { kind: 'notSent' } }] }))
    })

    it('drops a text the API refused as invalid, which goes back to the draft', () => {
      const log = chatLogReducer(ready({ outgoing: [sending] }), {
        type: 'sendSettled',
        key: 'key-1',
        result: { kind: 'invalid', fieldErrors: [] },
      })

      expect(log).toEqual(ready())
    })

    it('says there is no chat when the API does not find the pair on send', () => {
      const log = chatLogReducer(ready({ outgoing: [sending] }), {
        type: 'sendSettled',
        key: 'key-1',
        result: { kind: 'notPaired' },
      })

      expect(log).toEqual({ kind: 'notPaired' })
    })

    it('ignores an answer for a text it no longer shows', () => {
      const log = ready({ outgoing: [sending] })

      expect(chatLogReducer(log, { type: 'sendSettled', key: 'other', result: { kind: 'failed' } })).toEqual(log)
    })
  })
})
