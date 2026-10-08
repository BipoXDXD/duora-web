import { describe, expect, it } from 'vitest'
import { FIELD_ERROR_CODES, type FieldErrorCode } from '../../shared/api/http.ts'
import { PROFILE_FIELDS } from './profile.ts'
import { problemsFromApi } from './profileApiProblems.ts'

describe('problemsFromApi', () => {
  it.each([
    ['displayName', 'REQUIRED', 'blank'],
    ['displayName', 'TOO_SHORT', 'blank'],
    ['displayName', 'TOO_LONG', 'tooLong'],
    ['displayName', 'FORBIDDEN_CHARACTER', 'forbiddenCharacter'],
    ['displayName', 'INVALID_FORMAT', 'rejected'],
    ['birthDate', 'INVALID_FORMAT', 'notADate'],
    ['birthDate', 'ABOVE_MAXIMUM', 'underage'],
    ['birthDate', 'BELOW_MINIMUM', 'implausibleAge'],
    ['birthDate', 'REQUIRED', 'rejected'],
    ['bio', 'TOO_LONG', 'tooLong'],
    ['bio', 'FORBIDDEN_CHARACTER', 'forbiddenCharacter'],
    ['bio', 'INVALID_FORMAT', 'rejected'],
    ['region', 'UNSUPPORTED_VALUE', 'rejected'],
    ['region', 'REQUIRED', 'rejected'],
    ['bio', 'UNRECOGNIZED', 'rejected'],
  ] as const)('reads %s with %s as "%s"', (field, code, problem) => {
    expect(problemsFromApi([{ field, code }])).toEqual({ problems: { [field]: problem }, hasUnplacedProblem: false })
  })

  it('keeps one problem for each refused field', () => {
    const result = problemsFromApi([
      { field: 'bio', code: 'TOO_LONG' },
      { field: 'region', code: 'UNSUPPORTED_VALUE' },
    ])

    expect(result).toEqual({ problems: { bio: 'tooLong', region: 'rejected' }, hasUnplacedProblem: false })
  })

  it('keeps the first error of a field that came twice', () => {
    const result = problemsFromApi([
      { field: 'bio', code: 'TOO_LONG' },
      { field: 'bio', code: 'FORBIDDEN_CHARACTER' },
    ])

    expect(result.problems).toEqual({ bio: 'tooLong' })
  })

  it('has nothing to place, and a problem left over, when the API listed no error', () => {
    expect(problemsFromApi([])).toEqual({ problems: {}, hasUnplacedProblem: true })
  })

  it.each([
    ['an error of the whole body', { field: null, code: 'MALFORMED_BODY' }],
    ['a field that is not in the form', { field: 'nickname', code: 'UNKNOWN_FIELD' }],
    ['a field that only looks like one', { field: 'BIO', code: 'TOO_LONG' }],
  ] as const)('leaves %s as a problem of the whole form', (_case, error) => {
    expect(problemsFromApi([error])).toEqual({ problems: {}, hasUnplacedProblem: true })
  })

  it('places the errors it can and still flags the one it cannot', () => {
    const result = problemsFromApi([
      { field: 'bio', code: 'TOO_LONG' },
      { field: null, code: 'MALFORMED_BODY' },
    ])

    expect(result).toEqual({ problems: { bio: 'tooLong' }, hasUnplacedProblem: true })
  })

  it.each(PROFILE_FIELDS)('gives %s a problem for every code of the spec, never leaving the field unmarked', (field) => {
    const codes: readonly FieldErrorCode[] = [...FIELD_ERROR_CODES, 'UNRECOGNIZED']

    for (const code of codes) {
      expect(problemsFromApi([{ field, code }]).problems[field]).toBeDefined()
    }
  })
})
