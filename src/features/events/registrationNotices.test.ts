import { describe, expect, it } from 'vitest'
import { noticeOfCancel, noticeOfRegister } from './registrationNotices.ts'

describe('noticeOfRegister', () => {
  it.each([
    [null, 'Muita gente está se inscrevendo agora. Tente de novo em instantes.'],
    [0, 'Muita gente está se inscrevendo agora. Tente de novo em instantes.'],
    [1, 'Muita gente está se inscrevendo agora. Tente de novo em 1 segundo.'],
    [5, 'Muita gente está se inscrevendo agora. Tente de novo em 5 segundos.'],
  ])('asks to wait %s seconds when the event is busy', (retryAfterSeconds, text) => {
    expect(noticeOfRegister({ kind: 'busy', retryAfterSeconds })).toEqual({ tone: 'error', text, action: null })
  })

  it('offers to complete the profile when it is incomplete', () => {
    expect(noticeOfRegister({ kind: 'profileIncomplete' }).action).toBe('completeProfile')
  })

  it('offers to sign in again when the session ended', () => {
    expect(noticeOfRegister({ kind: 'signedOut' }).action).toBe('signIn')
    expect(noticeOfCancel({ kind: 'signedOut' }).action).toBe('signIn')
  })
})
