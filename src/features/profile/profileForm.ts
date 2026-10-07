import type { EditProfileRequest } from '../../shared/api/contract.ts'
import type { Profile, ProfileField, Region } from './profile.ts'

/** O que está nos campos do formulário: texto como foi digitado, `''` para vazio. */
export interface ProfileFormValues {
  readonly displayName: string
  /** `AAAA-MM-DD`, como o `<input type="date">` entrega, ou `''`. */
  readonly birthDate: string
  readonly bio: string
  readonly region: Region | ''
}

export type FieldProblem = 'blank' | 'tooLong' | 'notADate' | 'underage' | 'implausibleAge' | 'rejected'

export type FieldProblems = Readonly<Partial<Record<ProfileField, FieldProblem>>>

export type ProfileFormCheck =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'invalid'; readonly problems: FieldProblems }
  | { readonly kind: 'changed'; readonly changes: EditProfileRequest }

/** Os mesmos limites do domínio da duora-api (DisplayName, Bio e AgePolicy). */
export const DISPLAY_NAME_MAX_LENGTH = 50
export const BIO_MAX_LENGTH = 300
const ADULT_AGE = 18
const MAX_PLAUSIBLE_AGE = 120

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

type FieldOutcome<T> =
  | { readonly kind: 'keep' }
  | { readonly kind: 'set'; readonly value: T }
  | { readonly kind: 'problem'; readonly problem: FieldProblem }

const KEEP = { kind: 'keep' } as const

export function formValuesOf(profile: Profile): ProfileFormValues {
  return {
    displayName: profile.displayName ?? '',
    birthDate: profile.birthDate ?? '',
    bio: profile.bio ?? '',
    region: profile.region ?? '',
  }
}

/**
 * Compara o formulário com o perfil lido e devolve só o que mudou, já no formato do PATCH, ou os problemas
 * de cada campo. As regras repetem as da API para o erro aparecer antes de enviar; quem decide é a API.
 * `today` é a data local em `AAAA-MM-DD`.
 */
export function checkProfileForm(values: ProfileFormValues, baseline: Profile, today: string): ProfileFormCheck {
  const displayName = checkDisplayName(values.displayName, baseline.displayName)
  const birthDate = checkBirthDate(values.birthDate, baseline.birthDate, today)
  const bio = checkBio(values.bio, baseline.bio)
  const region = values.region === '' || values.region === baseline.region ? KEEP : setTo(values.region)
  const problems: FieldProblems = {
    ...(displayName.kind === 'problem' && { displayName: displayName.problem }),
    ...(birthDate.kind === 'problem' && { birthDate: birthDate.problem }),
    ...(bio.kind === 'problem' && { bio: bio.problem }),
  }
  if (Object.keys(problems).length > 0) {
    return { kind: 'invalid', problems }
  }
  const changes: EditProfileRequest = {
    ...(displayName.kind === 'set' && { displayName: displayName.value }),
    ...(birthDate.kind === 'set' && { birthDate: birthDate.value }),
    ...(bio.kind === 'set' && { bio: bio.value }),
    ...(region.kind === 'set' && { region: region.value }),
  }
  return Object.keys(changes).length === 0 ? { kind: 'unchanged' } : { kind: 'changed', changes }
}

/**
 * Depois de um 412: o perfil mudou em outro lugar. Os campos que a pessoa editou continuam como ela os
 * deixou; os outros passam a mostrar a versão nova. A data de nascimento informada em outro lugar vence,
 * porque não muda mais.
 */
export function rebaseFormValues(
  values: ProfileFormValues,
  oldBaseline: Profile,
  newBaseline: Profile,
): ProfileFormValues {
  const before = formValuesOf(oldBaseline)
  const after = formValuesOf(newBaseline)
  const pick = <K extends keyof ProfileFormValues>(field: K) => (values[field] === before[field] ? after : values)[field]
  return {
    displayName: pick('displayName'),
    birthDate: newBaseline.birthDate === null ? pick('birthDate') : after.birthDate,
    bio: pick('bio'),
    region: pick('region'),
  }
}

/** A data de hoje no fuso do navegador, em `AAAA-MM-DD`. */
export function todayIsoDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function checkDisplayName(typed: string, current: string | null): FieldOutcome<string> {
  const name = typed.trim()
  if (name === (current ?? '')) {
    return KEEP
  }
  if (name === '') {
    return problem('blank')
  }
  return lengthOf(name) > DISPLAY_NAME_MAX_LENGTH ? problem('tooLong') : setTo(name)
}

/** Vazio apaga a bio, como o `null`. */
function checkBio(typed: string, current: string | null): FieldOutcome<string | null> {
  const bio = typed.trim()
  if (bio === (current ?? '')) {
    return KEEP
  }
  if (bio === '') {
    return setTo(null)
  }
  return lengthOf(bio) > BIO_MAX_LENGTH ? problem('tooLong') : setTo(bio)
}

/** Informada uma vez, a data não muda: depois disso o campo nunca entra no PATCH. */
function checkBirthDate(typed: string, current: string | null, today: string): FieldOutcome<string> {
  if (current !== null || typed === '') {
    return KEEP
  }
  const age = ageOn(typed, today)
  if (age === null) {
    return problem('notADate')
  }
  if (age < ADULT_AGE) {
    return problem('underage')
  }
  return age > MAX_PLAUSIBLE_AGE ? problem('implausibleAge') : setTo(typed)
}

/**
 * Anos completos em `today`, ou `null` se `birthDate` não é uma data que existe. Quem nasceu em 29 de
 * fevereiro faz aniversário em 1º de março nos anos comuns (Código Civil, art. 132, § 3º), como na API.
 */
function ageOn(birthDate: string, today: string): number | null {
  const birth = partsOf(birthDate)
  const now = partsOf(today)
  if (birth === null || now === null) {
    return null
  }
  const hadBirthdayThisYear = now.month > birth.month || (now.month === birth.month && now.day >= birth.day)
  return now.year - birth.year - (hadBirthdayThisYear ? 0 : 1)
}

function partsOf(isoDate: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(isoDate)
  if (match === null) {
    return null
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  const exists = date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return exists ? { year, month, day } : null
}

/** Em caracteres, como a API conta (code points depois do NFC), e não em unidades UTF-16. */
function lengthOf(text: string): number {
  return [...text.normalize('NFC')].length
}

function setTo<T>(value: T): FieldOutcome<T> {
  return { kind: 'set', value }
}

function problem(found: FieldProblem): FieldOutcome<never> {
  return { kind: 'problem', problem: found }
}
