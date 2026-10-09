import { describe, expect, it } from 'vitest'
import { FIELD_ERROR_CODES, type FieldError } from '../../shared/api/http.ts'
import { eventProblemsFromApi } from './adminEventApiProblems.ts'

describe('eventProblemsFromApi', () => {
  it.each([
    ['title', 'REQUIRED', 'blank'],
    ['title', 'TOO_SHORT', 'blank'],
    ['title', 'TOO_LONG', 'tooLong'],
    ['title', 'FORBIDDEN_CHARACTER', 'forbiddenCharacter'],
    ['description', 'REQUIRED', 'blank'],
    ['description', 'TOO_SHORT', 'blank'],
    ['description', 'TOO_LONG', 'tooLong'],
    ['description', 'FORBIDDEN_CHARACTER', 'forbiddenCharacter'],
    ['startsAt', 'REQUIRED', 'blank'],
    ['startsAt', 'INVALID_FORMAT', 'notADate'],
    ['startsAt', 'BELOW_MINIMUM', 'inThePast'],
    ['startsAt', 'ABOVE_MAXIMUM', 'tooFarAhead'],
    ['endsAt', 'REQUIRED', 'blank'],
    ['endsAt', 'INVALID_FORMAT', 'notADate'],
    ['endsAt', 'BELOW_MINIMUM', 'notAfterStart'],
    ['endsAt', 'ABOVE_MAXIMUM', 'durationTooLong'],
    ['capacity', 'REQUIRED', 'blank'],
    ['capacity', 'INVALID_FORMAT', 'notANumber'],
    ['capacity', 'BELOW_MINIMUM', 'belowMinimum'],
    ['capacity', 'ABOVE_MAXIMUM', 'aboveMaximum'],
  ] as const)('reads %s with the code %s as %s', (field, code, problem) => {
    expect(eventProblemsFromApi([{ field, code }])).toEqual({ problems: { [field]: problem }, hasUnplacedProblem: false })
  })

  it('marks a field refused for a code it has no meaning for as rejected', () => {
    expect(
      eventProblemsFromApi([
        { field: 'capacity', code: 'FORBIDDEN_CHARACTER' },
        { field: 'title', code: 'UNRECOGNIZED' },
      ]),
    ).toEqual({ problems: { capacity: 'rejected', title: 'rejected' }, hasUnplacedProblem: false })
  })

  it('keeps the first error of a field', () => {
    const errors: readonly FieldError[] = [
      { field: 'title', code: 'TOO_LONG' },
      { field: 'title', code: 'FORBIDDEN_CHARACTER' },
    ]

    expect(eventProblemsFromApi(errors).problems).toEqual({ title: 'tooLong' })
  })

  it.each<[string, readonly FieldError[]]>([
    ['an error of the whole body', [{ field: null, code: 'MALFORMED_BODY' }]],
    ['an unknown field', [{ field: 'status', code: 'UNKNOWN_FIELD' }]],
    ['an empty list', []],
  ])('flags %s as unplaced', (_name, errors) => {
    expect(eventProblemsFromApi(errors).hasUnplacedProblem).toBe(true)
  })

  it('places the fields it knows and flags the one it does not', () => {
    expect(
      eventProblemsFromApi([
        { field: 'capacity', code: 'ABOVE_MAXIMUM' },
        { field: 'visibility', code: 'UNKNOWN_FIELD' },
      ]),
    ).toEqual({ problems: { capacity: 'aboveMaximum' }, hasUnplacedProblem: true })
  })

  it('handles every code the spec declares without throwing', () => {
    for (const code of FIELD_ERROR_CODES) {
      expect(() => eventProblemsFromApi([{ field: 'endsAt', code }])).not.toThrow()
    }
  })
})
