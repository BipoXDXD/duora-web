import type { ProfileField } from './profile.ts'
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, type FieldProblem } from './profileForm.ts'

/** Sem o fuso, `1990-05-10` vira 9 de maio a oeste de Greenwich: a data é lida e escrita em UTC. */
const BIRTH_DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })

/** `1990-05-10` como "10 de maio de 1990". */
export function formatBirthDate(isoDate: string): string {
  return BIRTH_DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`))
}

/** O que a API recusou sem regra que o front conheça, como um caractere invisível. */
const REJECTED: Readonly<Record<ProfileField, string>> = {
  displayName: 'Confira o nome: use uma linha só, sem caracteres invisíveis.',
  birthDate: 'Confira a data de nascimento.',
  bio: 'Confira a apresentação: ela tem caracteres que não são aceitos.',
  region: 'Escolha um estado da lista.',
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
    case 'rejected':
      return REJECTED[field]
  }
}
