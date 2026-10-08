import type { ProfileField } from './profile.ts'
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, type FieldProblem } from './profileForm.ts'

/** Sem o fuso, `1990-05-10` vira 9 de maio a oeste de Greenwich: a data é lida e escrita em UTC. */
const BIRTH_DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })

/** `1990-05-10` como "10 de maio de 1990". */
export function formatBirthDate(isoDate: string): string {
  return BIRTH_DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`))
}

/** O que a API recusou por um motivo que o front não distingue: só diz qual campo conferir. */
const REJECTED: Readonly<Record<ProfileField, string>> = {
  displayName: 'Confira o nome.',
  birthDate: 'Confira a data de nascimento.',
  bio: 'Confira a apresentação.',
  region: 'Escolha um estado da lista.',
}

/** Caractere de controle, invisível ou espaço especial: só nome e apresentação são texto livre. */
const FORBIDDEN_CHARACTER: Readonly<Partial<Record<ProfileField, string>>> = {
  displayName: 'Use uma linha só, sem caracteres invisíveis.',
  bio: 'A apresentação tem caracteres que não são aceitos.',
}

export function problemMessage(field: ProfileField, problem: FieldProblem): string {
  switch (problem) {
    case 'blank':
      return 'Informe seu nome.'
    case 'tooLong':
      return `Use no máximo ${field === 'bio' ? BIO_MAX_LENGTH : DISPLAY_NAME_MAX_LENGTH} caracteres.`
    case 'notADate':
      return 'Informe uma data válida.'
    case 'underage':
      return 'O Duora é só para maiores de 18 anos.'
    case 'implausibleAge':
      return 'Confira o ano de nascimento.'
    case 'forbiddenCharacter':
      return FORBIDDEN_CHARACTER[field] ?? REJECTED[field]
    case 'rejected':
      return REJECTED[field]
  }
}
