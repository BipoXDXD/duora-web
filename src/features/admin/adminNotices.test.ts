import { describe, expect, it } from 'vitest'
import { noticeOfChange, noticeOfCreateFailure, noticeOfRound } from './adminNotices.ts'
import type { AdminEvent, AdminRound, EventActionResult, StartRoundResult } from './adminEvents.ts'

const EVENT: AdminEvent = {
  id: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b',
  title: 'Jantar',
  description: 'Jogos.',
  startsAt: new Date('2026-10-10T22:00:00Z'),
  endsAt: new Date('2026-10-11T01:00:00Z'),
  status: 'PUBLISHED',
  capacity: 40,
  registrationCount: 3,
}
const ROUND: AdminRound = {
  eventId: EVENT.id,
  number: 2,
  pairCount: 1,
  sittingOutCount: 0,
  startedAt: new Date('2026-10-10T23:00:00Z'),
}

describe('noticeOfChange', () => {
  it.each([
    ['publish', 'Evento publicado. Ele já aparece para quem entrou e aceita inscrições.'],
    ['cancel', 'Evento cancelado. Ele continua visível para quem se inscreveu, mas não aceita mais inscrições.'],
  ] as const)('confirms the %s', (change, text) => {
    expect(noticeOfChange(change, { kind: 'done', event: EVENT })).toEqual({ tone: 'success', text, action: null })
  })

  it.each([
    ['publish', 'EVENT_ALREADY_PUBLISHED', 'Este evento já estava publicado.'],
    ['publish', 'EVENT_CANCELLED', 'Este evento foi cancelado, então não dá mais para publicá-lo.'],
    ['publish', 'EVENT_STARTED', 'Este evento já começou, então não dá mais para publicá-lo.'],
    ['publish', 'EVENT_ENDED', 'Este evento já terminou, então não dá mais para publicá-lo.'],
    ['cancel', 'EVENT_CANCELLED', 'Este evento já estava cancelado.'],
    ['cancel', 'EVENT_ENDED', 'Este evento já terminou, então não dá mais para cancelá-lo.'],
  ] as const)('explains the 409 of %s with the reason %s', (change, reason, text) => {
    expect(noticeOfChange(change, { kind: 'refused', reason })).toEqual({ tone: 'error', text, action: null })
  })

  it.each([
    ['publish', null],
    ['publish', 'UNRECOGNIZED'],
    ['publish', 'EVENT_FULL'],
    ['cancel', null],
    ['cancel', 'EVENT_ALREADY_PUBLISHED'],
  ] as const)('falls back to the generic refusal of %s with the reason %s', (change, reason) => {
    const notice = noticeOfChange(change, { kind: 'refused', reason })

    expect(notice.tone).toBe('error')
    expect(notice.text).toContain('mudou ao mesmo tempo')
  })

  it.each<[string, EventActionResult, string, 'signIn' | null]>([
    ['403', { kind: 'forbidden' }, 'Área só para a equipe.', null],
    ['404', { kind: 'notFound' }, 'Este evento não existe mais.', null],
    ['401', { kind: 'signedOut' }, 'Sua sessão terminou. Entre de novo para continuar.', 'signIn'],
    ['another failure', { kind: 'failed' }, 'Não foi possível publicar o evento. Tente de novo.', null],
  ])('tells the %s of publishing', (_name, result, text, action) => {
    expect(noticeOfChange('publish', result)).toEqual({ tone: 'error', text, action })
  })

  it('tells the failure of cancelling', () => {
    expect(noticeOfChange('cancel', { kind: 'failed' }).text).toBe('Não foi possível cancelar o evento. Tente de novo.')
  })
})

describe('noticeOfRound', () => {
  it('tells a round that was just created', () => {
    expect(noticeOfRound(2, { kind: 'started', round: ROUND, isNew: true })).toEqual({
      tone: 'success',
      text: 'Rodada 2 iniciada. Cada pessoa já pode ver a própria dupla.',
      action: null,
    })
  })

  it('tells a round that already existed, without a new draw', () => {
    expect(noticeOfRound(2, { kind: 'started', round: ROUND, isNew: false }).text).toBe(
      'A rodada 2 já tinha sido iniciada. Esta é a mesma, sem novo sorteio.',
    )
  })

  it.each<[string, StartRoundResult, string]>([
    ['EVENT_NOT_UNDERWAY', { kind: 'notUnderway' }, 'Só dá para iniciar uma rodada com o evento publicado e em andamento.'],
    ['ROUND_OUT_OF_SEQUENCE', { kind: 'outOfSequence' }, 'Não dá para iniciar a rodada 3: a anterior ainda não começou.'],
    ['a 409 without a known reason', { kind: 'refused' }, 'Não foi possível iniciar a rodada: o evento mudou.'],
    ['a 403', { kind: 'forbidden' }, 'Área só para a equipe.'],
    ['a 404', { kind: 'notFound' }, 'Este evento não existe mais.'],
    ['another failure', { kind: 'failed' }, 'Não foi possível iniciar a rodada. Tente de novo;'],
  ])('tells %s', (_name, result, text) => {
    const notice = noticeOfRound(3, result)

    expect(notice.tone).toBe('error')
    expect(notice.text).toContain(text)
  })

  it('offers to sign in again when the session ended', () => {
    expect(noticeOfRound(3, { kind: 'signedOut' }).action).toBe('signIn')
  })

  it.each([
    [{ kind: 'busy', cause: 'rateLimited', retryAfterSeconds: 120 }, 'Você atingiu o limite de rodadas por hora. Tente de novo em 120 segundos.'],
    [{ kind: 'busy', cause: 'rateLimited', retryAfterSeconds: null }, 'Você atingiu o limite de rodadas por hora. Tente de novo em instantes.'],
    [{ kind: 'busy', cause: 'contended', retryAfterSeconds: 1 }, 'Nada foi gravado. Tente de novo em 1 segundo.'],
  ] as const)('tells %o', (result, text) => {
    expect(noticeOfRound(3, result).text).toContain(text)
  })
})

describe('noticeOfCreateFailure', () => {
  it.each([
    ['forbidden', 'Área só para a equipe.'],
    ['signedOut', 'Sua sessão terminou.'],
    ['failed', 'haverá dois rascunhos'],
    ['notFound', 'haverá dois rascunhos'],
  ] as const)('tells %s', (kind, text) => {
    expect(noticeOfCreateFailure(kind).text).toContain(text)
  })
})
