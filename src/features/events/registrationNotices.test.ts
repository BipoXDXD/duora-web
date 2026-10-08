import { describe, expect, it } from 'vitest'
import { noticeOfCancel, noticeOfRegister } from './registrationNotices.ts'

describe('noticeOfRegister', () => {
  it.each([
    [null, 'Muitos pedidos de inscrição em pouco tempo. Tente de novo em instantes.'],
    [0, 'Muitos pedidos de inscrição em pouco tempo. Tente de novo em instantes.'],
    [1, 'Muitos pedidos de inscrição em pouco tempo. Tente de novo em 1 segundo.'],
    [5, 'Muitos pedidos de inscrição em pouco tempo. Tente de novo em 5 segundos.'],
  ])('asks to wait %s seconds when the event is busy', (retryAfterSeconds, text) => {
    expect(noticeOfRegister({ kind: 'busy', retryAfterSeconds })).toEqual({ tone: 'error', text, action: null })
  })

  it('offers to complete the profile when it is incomplete, and names what is missing', () => {
    const notice = noticeOfRegister({ kind: 'profileIncomplete' })

    expect(notice.action).toBe('completeProfile')
    expect(notice.text).toBe(
      'Para se inscrever, seu perfil precisa estar completo: nome, data de nascimento e região.',
    )
  })

  it('tells an underage account that events are for adults, with no link to complete the profile', () => {
    expect(noticeOfRegister({ kind: 'underage' })).toEqual({
      tone: 'error',
      text: 'Os eventos do Duora são só para maiores de 18 anos, por isso não foi possível fazer esta inscrição.',
      action: null,
    })
  })

  it('says the account cannot take part when the API refused without a reason', () => {
    expect(noticeOfRegister({ kind: 'notAllowed' })).toEqual({
      tone: 'error',
      text: 'Não foi possível fazer a inscrição: sua conta não pode participar deste evento.',
      action: null,
    })
  })

  it.each([
    ['full', 'O evento lotou, então não dá mais para se inscrever.'],
    ['cancelled', 'O evento foi cancelado, então não dá mais para se inscrever.'],
    ['started', 'O evento já começou, e as inscrições estão fechadas.'],
    ['ended', 'O evento já terminou, e as inscrições estão fechadas.'],
    [null, 'Não dá mais para se inscrever: o evento lotou, foi cancelado ou já começou.'],
  ] as const)('explains an unavailable event by its cause %s', (cause, text) => {
    expect(noticeOfRegister({ kind: 'unavailable', cause })).toEqual({ tone: 'error', text, action: null })
  })

  it('offers to sign in again when the session ended', () => {
    expect(noticeOfRegister({ kind: 'signedOut' }).action).toBe('signIn')
    expect(noticeOfCancel({ kind: 'signedOut' }).action).toBe('signIn')
  })
})

describe('noticeOfCancel', () => {
  it.each([
    ['started', 'O evento já começou, então a inscrição não pode mais ser cancelada.'],
    ['ended', 'O evento já terminou, então a inscrição não pode mais ser cancelada.'],
    [null, 'A inscrição não pode mais ser cancelada: o evento já começou ou terminou.'],
  ] as const)('explains a cancel that came too late by its cause %s', (cause, text) => {
    expect(noticeOfCancel({ kind: 'tooLate', cause })).toEqual({ tone: 'error', text, action: null })
  })

  it.each([
    [null, 'Muitos pedidos de inscrição em pouco tempo. Tente de novo em instantes.'],
    [4, 'Muitos pedidos de inscrição em pouco tempo. Tente de novo em 4 segundos.'],
  ])('asks to wait %s seconds when the account is over the limit', (retryAfterSeconds, text) => {
    expect(noticeOfCancel({ kind: 'busy', retryAfterSeconds })).toEqual({ tone: 'error', text, action: null })
  })

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
