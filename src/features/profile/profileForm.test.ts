import { describe, expect, it } from 'vitest'
import type { Profile } from './profile.ts'
import { checkProfileForm, formValuesOf, rebaseFormValues, todayIsoDate, type ProfileFormValues } from './profileForm.ts'

const EMPTY: Profile = { displayName: null, birthDate: null, bio: null, region: null, complete: false }
const ANA: Profile = {
  displayName: 'Ana Souza',
  birthDate: '1990-05-10',
  bio: 'Gosto de jogos de cartas.',
  region: 'BR-SP',
  complete: true,
}
const TODAY = '2026-10-07'

function valuesFor(profile: Profile, edits: Partial<ProfileFormValues> = {}): ProfileFormValues {
  return { ...formValuesOf(profile), ...edits }
}

describe('formValuesOf', () => {
  it('shows an empty profile as empty fields', () => {
    expect(formValuesOf(EMPTY)).toEqual({ displayName: '', birthDate: '', bio: '', region: '' })
  })

  it('shows a filled profile as it is', () => {
    expect(formValuesOf(ANA)).toEqual({
      displayName: 'Ana Souza',
      birthDate: '1990-05-10',
      bio: 'Gosto de jogos de cartas.',
      region: 'BR-SP',
    })
  })
})

describe('checkProfileForm', () => {
  it('has nothing to save when no field changed', () => {
    expect(checkProfileForm(valuesFor(ANA), ANA, TODAY)).toEqual({ kind: 'unchanged' })
  })

  it('has nothing to save when only spaces were added around the name and the bio', () => {
    const values = valuesFor(ANA, { displayName: '  Ana Souza ', bio: ' Gosto de jogos de cartas.\n' })

    expect(checkProfileForm(values, ANA, TODAY)).toEqual({ kind: 'unchanged' })
  })

  it('leaves empty fields of an empty profile out of the changes', () => {
    expect(checkProfileForm(valuesFor(EMPTY), EMPTY, TODAY)).toEqual({ kind: 'unchanged' })
  })

  it('sends only the fields that changed, trimmed', () => {
    const values = valuesFor(ANA, { displayName: ' Ana S. ', region: 'BR-RJ' })

    expect(checkProfileForm(values, ANA, TODAY)).toEqual({
      kind: 'changed',
      changes: { displayName: 'Ana S.', region: 'BR-RJ' },
    })
  })

  it('fills every field of an empty profile', () => {
    const values: ProfileFormValues = { displayName: 'Ana', birthDate: '1990-05-10', bio: 'Oi', region: 'BR-BA' }

    expect(checkProfileForm(values, EMPTY, TODAY)).toEqual({
      kind: 'changed',
      changes: { displayName: 'Ana', birthDate: '1990-05-10', bio: 'Oi', region: 'BR-BA' },
    })
  })

  describe('name', () => {
    it.each(['', '   '])('cannot be erased once given (%j)', (displayName) => {
      expect(checkProfileForm(valuesFor(ANA, { displayName }), ANA, TODAY)).toEqual({
        kind: 'invalid',
        problems: { displayName: 'blank' },
      })
    })

    it('accepts 50 characters', () => {
      const displayName = 'a'.repeat(50)

      expect(checkProfileForm(valuesFor(ANA, { displayName }), ANA, TODAY)).toEqual({
        kind: 'changed',
        changes: { displayName },
      })
    })

    it('refuses 51 characters', () => {
      expect(checkProfileForm(valuesFor(ANA, { displayName: 'a'.repeat(51) }), ANA, TODAY)).toEqual({
        kind: 'invalid',
        problems: { displayName: 'tooLong' },
      })
    })

    it('counts an emoji as one character, as the API does', () => {
      const displayName = '😀'.repeat(50)

      expect(checkProfileForm(valuesFor(ANA, { displayName }), ANA, TODAY)).toEqual({
        kind: 'changed',
        changes: { displayName },
      })
    })
  })

  describe('bio', () => {
    it.each(['', '  \n '])('is erased with null when cleared (%j)', (bio) => {
      expect(checkProfileForm(valuesFor(ANA, { bio }), ANA, TODAY)).toEqual({ kind: 'changed', changes: { bio: null } })
    })

    it('accepts 300 characters', () => {
      const bio = 'b'.repeat(300)

      expect(checkProfileForm(valuesFor(ANA, { bio }), ANA, TODAY)).toEqual({ kind: 'changed', changes: { bio } })
    })

    it('refuses 301 characters', () => {
      expect(checkProfileForm(valuesFor(ANA, { bio: 'b'.repeat(301) }), ANA, TODAY)).toEqual({
        kind: 'invalid',
        problems: { bio: 'tooLong' },
      })
    })

    it('keeps the line breaks between paragraphs', () => {
      const bio = 'Primeiro.\n\nSegundo.'

      expect(checkProfileForm(valuesFor(ANA, { bio }), ANA, TODAY)).toEqual({ kind: 'changed', changes: { bio } })
    })
  })

  describe('birth date', () => {
    it.each([
      ['turns 18 today', '2008-10-07'],
      ['turned 120 today', '1906-10-07'],
    ])('is accepted for someone who %s', (_case, birthDate) => {
      expect(checkProfileForm(valuesFor(EMPTY, { birthDate }), EMPTY, TODAY)).toEqual({
        kind: 'changed',
        changes: { birthDate },
      })
    })

    it.each([
      ['turns 18 tomorrow', '2008-10-08'],
      ['is born in the future', '2027-01-01'],
    ])('is refused for someone who %s', (_case, birthDate) => {
      expect(checkProfileForm(valuesFor(EMPTY, { birthDate }), EMPTY, TODAY)).toEqual({
        kind: 'invalid',
        problems: { birthDate: 'underage' },
      })
    })

    it('is refused for someone who would turn 121 today', () => {
      expect(checkProfileForm(valuesFor(EMPTY, { birthDate: '1905-10-07' }), EMPTY, TODAY)).toEqual({
        kind: 'invalid',
        problems: { birthDate: 'implausibleAge' },
      })
    })

    it('treats someone born on February 29 as turning 18 on March 1 in a common year', () => {
      const birthDate = '2008-02-29'

      expect(checkProfileForm(valuesFor(EMPTY, { birthDate }), EMPTY, '2026-02-28')).toMatchObject({ kind: 'invalid' })
      expect(checkProfileForm(valuesFor(EMPTY, { birthDate }), EMPTY, '2026-03-01')).toMatchObject({ kind: 'changed' })
    })

    it.each(['10/05/1990', '1990-02-30', '1990-13-01', 'ontem'])('refuses %j, which is not a date', (birthDate) => {
      expect(checkProfileForm(valuesFor(EMPTY, { birthDate }), EMPTY, TODAY)).toEqual({
        kind: 'invalid',
        problems: { birthDate: 'notADate' },
      })
    })

    it('is never sent once given, since it cannot change', () => {
      const values = valuesFor(ANA, { birthDate: '1991-01-01', bio: 'Oi' })

      expect(checkProfileForm(values, ANA, TODAY)).toEqual({ kind: 'changed', changes: { bio: 'Oi' } })
    })
  })

  it('reports every invalid field at once', () => {
    const values = valuesFor(ANA, { displayName: '', bio: 'b'.repeat(301) })

    expect(checkProfileForm(values, ANA, TODAY)).toEqual({
      kind: 'invalid',
      problems: { displayName: 'blank', bio: 'tooLong' },
    })
  })
})

describe('rebaseFormValues', () => {
  const other: Profile = { ...ANA, displayName: 'Ana (outra aba)', bio: 'Mudou em outra aba.' }

  it('keeps what the user typed and takes the new version of the fields not touched', () => {
    const typed = valuesFor(ANA, { bio: 'Minha bio nova.' })

    expect(rebaseFormValues(typed, ANA, other)).toEqual({
      displayName: 'Ana (outra aba)',
      birthDate: '1990-05-10',
      bio: 'Minha bio nova.',
      region: 'BR-SP',
    })
  })

  it('takes the birth date given elsewhere, since it can no longer change', () => {
    const typed = valuesFor(EMPTY, { birthDate: '1995-01-01' })

    expect(rebaseFormValues(typed, EMPTY, { ...EMPTY, birthDate: '1990-05-10' }).birthDate).toBe('1990-05-10')
  })
})

describe('todayIsoDate', () => {
  it('writes the local date as an ISO date', () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
