import { describe, expect, it } from 'vitest'
import { accountCode, formatEventTime, parseRoundNumber, PHASE_LABELS } from './eventText.ts'

describe('formatEventTime', () => {
  it('shows the weekday, the day and the hours in the time zone of the user', () => {
    const text = formatEventTime(new Date('2026-10-10T19:00:00Z'), new Date('2026-10-10T22:00:00Z'))

    expect(text).toMatch(/^sábado, 10 de outubro.*16:00.*19:00$/)
  })

  it('shows both days when the event crosses midnight', () => {
    const text = formatEventTime(new Date('2026-10-11T01:00:00Z'), new Date('2026-10-11T04:00:00Z'))

    expect(text).toMatch(/^sábado, 10 de outubro.*22:00.*domingo, 11 de outubro.*01:00$/)
  })
})

describe('PHASE_LABELS', () => {
  it('labels only the phases that change what the person can do', () => {
    expect(PHASE_LABELS).toEqual({
      upcoming: null,
      inProgress: 'Em andamento',
      ended: 'Encerrado',
      cancelled: 'Cancelado',
    })
  })
})

describe('accountCode', () => {
  it('is the end of the account id', () => {
    expect(accountCode('0199a1d2-1111-7aaa-8bbb-cccc1a2b3c4d')).toBe('1a2b3c4d')
  })
})

describe('parseRoundNumber', () => {
  it.each([
    ['1', 1],
    ['100', 100],
    [' 7 ', 7],
  ])('reads %j as round %i', (text, round) => {
    expect(parseRoundNumber(text)).toBe(round)
  })

  it.each(['', '  ', '0', '101', '-1', '1.5', '2e1', 'um', '1 2'])('rejects %j', (text) => {
    expect(parseRoundNumber(text)).toBeNull()
  })
})
