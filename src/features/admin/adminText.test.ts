import { describe, expect, it } from 'vitest'
import { EVENT_FIELDS, type EventFieldProblem } from './adminEventForm.ts'
import { ADMIN_PHASE_LABELS, problemMessage, roundCountsText } from './adminText.ts'

const PROBLEMS: readonly EventFieldProblem[] = [
  'blank',
  'tooLong',
  'forbiddenCharacter',
  'notADate',
  'inThePast',
  'tooFarAhead',
  'notAfterStart',
  'durationTooLong',
  'notANumber',
  'belowMinimum',
  'aboveMaximum',
  'rejected',
]

describe('problemMessage', () => {
  it('says which limit was crossed with the limits of the API', () => {
    expect(problemMessage('title', 'tooLong')).toBe('Use no máximo 80 caracteres.')
    expect(problemMessage('description', 'tooLong')).toBe('Use no máximo 500 caracteres.')
    expect(problemMessage('endsAt', 'durationTooLong')).toBe('O evento pode durar no máximo 12 horas.')
    expect(problemMessage('startsAt', 'tooFarAhead')).toBe('O início pode ser em até 365 dias.')
    expect(problemMessage('capacity', 'belowMinimum')).toBe('A capacidade mínima é de 2 pessoas.')
    expect(problemMessage('capacity', 'aboveMaximum')).toBe('A capacidade máxima é de 200 pessoas.')
  })

  it.each(EVENT_FIELDS)('has a non-empty message of %s for every problem', (field) => {
    for (const problem of PROBLEMS) {
      expect(problemMessage(field, problem).length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['title', 'Confira o título.'],
    ['description', 'Confira a descrição.'],
    ['startsAt', 'Confira o início.'],
    ['endsAt', 'Confira o fim.'],
    ['capacity', 'Confira a capacidade.'],
  ] as const)('tells to check the %s when the API refused it for a reason the front does not know', (field, text) => {
    expect(problemMessage(field, 'rejected')).toBe(text)
  })

  it('falls back to checking the field when the problem has no meaning in it', () => {
    expect(problemMessage('capacity', 'inThePast')).toBe('Confira a capacidade.')
  })
})

describe('ADMIN_PHASE_LABELS', () => {
  it('has a distinct text label for every phase', () => {
    const labels = Object.values(ADMIN_PHASE_LABELS)

    expect(labels).toHaveLength(5)
    expect(new Set(labels).size).toBe(5)
    expect(ADMIN_PHASE_LABELS.draft).toBe('Rascunho')
  })
})

describe('roundCountsText', () => {
  it.each([
    [{ pairCount: 12, sittingOutCount: 3 }, '12 pares; 3 pessoas ficaram de fora.'],
    [{ pairCount: 1, sittingOutCount: 1 }, '1 par; 1 pessoa ficou de fora.'],
    [{ pairCount: 0, sittingOutCount: 0 }, '0 pares; 0 pessoas ficaram de fora.'],
  ])('writes %o as %s', (round, text) => {
    expect(roundCountsText(round)).toBe(text)
  })
})
