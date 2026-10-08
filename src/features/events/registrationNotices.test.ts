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

describe('noticeOfCancel', () => {
  it.each([
    [{ kind: 'notFound' }, 'Este evento não existe mais.'],
    [{ kind: 'failed' }, 'Não foi possível cancelar a inscrição. Tente de novo.'],
  ] as const)('explains %o', (result, text) => {
    expect(noticeOfCancel(result)).toEqual({ tone: 'error', text, action: null })
  })
})

describe('noticeOfRegister for a gone event', () => {
  it('says the event does not exist anymore', () => {
    expect(noticeOfRegister({ kind: 'notFound' })).toEqual({
      tone: 'error',
      text: 'Este evento não existe mais.',
      action: null,
    })
  })
})
