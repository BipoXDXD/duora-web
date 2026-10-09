import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkEventForm,
  formatOffset,
  isEventField,
  userTimeZone,
  type EventFormValues,
} from './adminEventForm.ts'

/** 12:00 em Brasília, onde os testes rodam (`TZ` fixo no vite.config.ts). */
const NOW = new Date('2026-10-08T15:00:00Z')

const VALID: EventFormValues = {
  title: 'Jantar às cegas',
  description: 'Uma noite de jogos de mesa.',
  startsAt: '2026-10-10T19:00',
  endsAt: '2026-10-10T22:00',
  capacity: '40',
}

function check(changes: Partial<EventFormValues>) {
  return checkEventForm({ ...VALID, ...changes }, NOW)
}

function problemsOf(changes: Partial<EventFormValues>) {
  const result = check(changes)
  if (result.kind === 'valid') {
    throw new Error('o formulário deveria ter problemas')
  }
  return result.problems
}

describe('checkEventForm', () => {
  it('turns a valid form into the request, with the times in ISO 8601 with the offset of the user', () => {
    expect(check({})).toEqual({
      kind: 'valid',
      event: {
        title: 'Jantar às cegas',
        description: 'Uma noite de jogos de mesa.',
        startsAt: '2026-10-10T19:00:00-03:00',
        endsAt: '2026-10-10T22:00:00-03:00',
        capacity: 40,
      },
    })
  })

  it('sends the texts normalized the way the API stores them', () => {
    const result = check({
      title: '  Café da manhã  ',
      description: '\n Primeiro parágrafo.\r\n\r\nSegundo. \n',
      capacity: ' 40 ',
    })

    expect(result).toMatchObject({
      kind: 'valid',
      event: { title: 'Café da manhã', description: 'Primeiro parágrafo.\n\nSegundo.', capacity: 40 },
    })
  })

  it('reports every wrong field at once', () => {
    expect(
      checkEventForm({ title: '', description: '', startsAt: '', endsAt: '', capacity: '' }, NOW),
    ).toEqual({
      kind: 'invalid',
      problems: { title: 'blank', description: 'blank', startsAt: 'blank', endsAt: 'blank', capacity: 'blank' },
    })
  })

  describe('title', () => {
    it.each(['', '   ', '\n'])('refuses the blank title %j', (title) => {
      expect(problemsOf({ title })).toEqual({ title: 'blank' })
    })

    it('accepts 80 characters and refuses 81', () => {
      expect(check({ title: 'a'.repeat(80) }).kind).toBe('valid')
      expect(problemsOf({ title: 'a'.repeat(81) })).toEqual({ title: 'tooLong' })
    })

    it('counts a character outside the BMP once', () => {
      expect(check({ title: '😀'.repeat(80) }).kind).toBe('valid')
      expect(problemsOf({ title: '😀'.repeat(81) })).toEqual({ title: 'tooLong' })
    })

    it.each([
      ['a line break', 'Jantar\nàs cegas'],
      ['a tab', 'Jantar\tàs cegas'],
      ['a zero-width space', 'Jantar​às cegas'],
      ['a right-to-left mark', 'Jantar‏às cegas'],
      ['a no-break space', 'Jantar às cegas'],
      ['a NUL', 'Jantar\u0000às cegas'],
    ])('refuses %s inside the title', (_name, title) => {
      expect(problemsOf({ title })).toEqual({ title: 'forbiddenCharacter' })
    })

    it('accepts a composed emoji joined by a zero-width joiner', () => {
      const couple = '\u{1F469}\u200D\u2764\uFE0F\u200D\u{1F468}'
      expect(check({ title: `${couple} Jantar` }).kind).toBe('valid')
    })
  })

  describe('description', () => {
    it('accepts 500 characters and refuses 501', () => {
      expect(check({ description: 'a'.repeat(500) }).kind).toBe('valid')
      expect(problemsOf({ description: 'a'.repeat(501) })).toEqual({ description: 'tooLong' })
    })

    it('refuses a blank description', () => {
      expect(problemsOf({ description: ' \n ' })).toEqual({ description: 'blank' })
    })

    it('accepts a line break between paragraphs', () => {
      expect(check({ description: 'Um.\n\nDois.' }).kind).toBe('valid')
    })

    it.each([
      ['a tab', 'Um.\tDois.'],
      ['a zero-width space', 'Um.​Dois.'],
      ['a line separator', 'Um. Dois.'],
    ])('refuses %s', (_name, description) => {
      expect(problemsOf({ description })).toEqual({ description: 'forbiddenCharacter' })
    })
  })

  describe('start', () => {
    it('refuses a start that is not after now, and accepts one minute later', () => {
      expect(problemsOf({ startsAt: '2026-10-08T12:00', endsAt: '2026-10-08T14:00' })).toEqual({
        startsAt: 'inThePast',
      })
      expect(check({ startsAt: '2026-10-08T12:01', endsAt: '2026-10-08T14:00' }).kind).toBe('valid')
    })

    it('refuses a start in the past', () => {
      expect(problemsOf({ startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T22:00' })).toEqual({
        startsAt: 'inThePast',
      })
    })

    it('accepts a start exactly 365 days ahead and refuses one minute later', () => {
      expect(check({ startsAt: '2027-10-08T12:00', endsAt: '2027-10-08T14:00' }).kind).toBe('valid')
      expect(problemsOf({ startsAt: '2027-10-08T12:01', endsAt: '2027-10-08T14:00' })).toEqual({
        startsAt: 'tooFarAhead',
      })
    })

    it.each([
      ['amanhã', 'notADate'],
      ['2026-10-10', 'notADate'],
      ['2026-10-10T19:00:00', 'notADate'],
      ['2026-10-10T19:00-03:00', 'notADate'],
      ['2026-02-31T19:00', 'notADate'],
      ['2026-10-10T25:00', 'notADate'],
      ['', 'blank'],
    ] as const)('refuses the start %j as %s', (startsAt, problem) => {
      expect(problemsOf({ startsAt })).toEqual({ startsAt: problem })
    })
  })

  describe('end', () => {
    it('accepts a duration of exactly 12 hours and refuses one minute more', () => {
      expect(check({ endsAt: '2026-10-11T07:00' }).kind).toBe('valid')
      expect(problemsOf({ endsAt: '2026-10-11T07:01' })).toEqual({ endsAt: 'durationTooLong' })
    })

    it('accepts one minute of duration', () => {
      expect(check({ endsAt: '2026-10-10T19:01' }).kind).toBe('valid')
    })

    it.each([
      ['the same minute as the start', '2026-10-10T19:00'],
      ['before the start', '2026-10-10T18:00'],
    ])('refuses an end at %s', (_name, endsAt) => {
      expect(problemsOf({ endsAt })).toEqual({ endsAt: 'notAfterStart' })
    })

    it('reports only the format when the end is not a date', () => {
      expect(problemsOf({ endsAt: 'depois' })).toEqual({ endsAt: 'notADate' })
    })

    it('does not compare the end with a start that is not a date', () => {
      expect(problemsOf({ startsAt: 'x', endsAt: '2026-10-10T18:00' })).toEqual({ startsAt: 'notADate' })
    })

    it('still compares the end with a start that is in the past', () => {
      expect(problemsOf({ startsAt: '2026-10-01T19:00', endsAt: '2026-10-01T18:00' })).toEqual({
        startsAt: 'inThePast',
        endsAt: 'notAfterStart',
      })
    })

    it('does not compare the end with a start that is blank', () => {
      expect(problemsOf({ startsAt: '' })).toEqual({ startsAt: 'blank' })
    })
  })

  describe('capacity', () => {
    it.each([
      ['2', 2],
      ['200', 200],
      ['40', 40],
      [' 40 ', 40],
    ])('accepts %j', (capacity, places) => {
      expect(check({ capacity })).toMatchObject({ kind: 'valid', event: { capacity: places } })
    })

    it.each([
      ['', 'blank'],
      ['   ', 'blank'],
      ['1', 'belowMinimum'],
      ['0', 'belowMinimum'],
      ['-5', 'belowMinimum'],
      ['201', 'aboveMaximum'],
      ['abc', 'notANumber'],
      ['2.5', 'notANumber'],
      ['1e2', 'notANumber'],
      ['4 0', 'notANumber'],
    ] as const)('refuses %j as %s', (capacity, problem) => {
      expect(problemsOf({ capacity })).toEqual({ capacity: problem })
    })
  })
})

describe('time zones with daylight saving time', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('writes the offset in force on the day of each time', () => {
    vi.stubEnv('TZ', 'America/New_York')

    expect(check({ startsAt: '2027-01-10T19:00', endsAt: '2027-01-10T22:00' })).toMatchObject({
      kind: 'valid',
      event: { startsAt: '2027-01-10T19:00:00-05:00', endsAt: '2027-01-10T22:00:00-05:00' },
    })
    expect(check({ startsAt: '2027-06-10T19:00', endsAt: '2027-06-10T22:00' })).toMatchObject({
      kind: 'valid',
      event: { startsAt: '2027-06-10T19:00:00-04:00', endsAt: '2027-06-10T22:00:00-04:00' },
    })
  })

  it('refuses a time that the clock skips when it moves forward', () => {
    vi.stubEnv('TZ', 'America/New_York')

    expect(problemsOf({ startsAt: '2027-03-14T02:30', endsAt: '2027-03-14T05:00' })).toEqual({
      startsAt: 'notADate',
    })
  })

  it('writes a positive offset with minutes', () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')

    expect(check({})).toMatchObject({
      kind: 'valid',
      event: { startsAt: '2026-10-10T19:00:00+05:30', endsAt: '2026-10-10T22:00:00+05:30' },
    })
  })
})

describe('formatOffset', () => {
  it.each([
    [-180, '-03:00'],
    [0, '+00:00'],
    [60, '+01:00'],
    [330, '+05:30'],
    [-570, '-09:30'],
    [765, '+12:45'],
  ])('writes %i minutes east of UTC as %s', (minutes, offset) => {
    expect(formatOffset(minutes)).toBe(offset)
  })
})

describe('isEventField', () => {
  it.each(['title', 'description', 'startsAt', 'endsAt', 'capacity'])('knows %s', (name) => {
    expect(isEventField(name)).toBe(true)
  })

  it.each(['status', 'id', 'Title', ''])('does not know %j', (name) => {
    expect(isEventField(name)).toBe(false)
  })
})

describe('userTimeZone', () => {
  it('names the time zone the tests run in', () => {
    expect(userTimeZone()).toBe('America/Sao_Paulo')
  })
})
