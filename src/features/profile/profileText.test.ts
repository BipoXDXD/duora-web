import { describe, expect, it } from 'vitest'
import { formatBirthDate, problemMessage } from './profileText.ts'

describe('formatBirthDate', () => {
  it.each([
    ['1990-05-10', '10 de maio de 1990'],
    ['2000-01-01', '1 de janeiro de 2000'],
    ['1988-12-31', '31 de dezembro de 1988'],
  ])('writes %s as "%s", whatever the time zone of the browser', (isoDate, written) => {
    expect(formatBirthDate(isoDate)).toBe(written)
  })
})

describe('problemMessage', () => {
  it.each([
    ['displayName', 'blank', 'Informe seu nome.'],
    ['displayName', 'tooLong', 'Use no máximo 50 caracteres.'],
    ['bio', 'tooLong', 'Use no máximo 300 caracteres.'],
    ['birthDate', 'notADate', 'Informe uma data válida.'],
    ['birthDate', 'underage', 'O Duora é só para maiores de 18 anos.'],
    ['birthDate', 'implausibleAge', 'Confira o ano de nascimento.'],
    ['displayName', 'forbiddenCharacter', 'Use uma linha só, sem caracteres invisíveis.'],
    ['bio', 'forbiddenCharacter', 'A apresentação tem caracteres que não são aceitos.'],
    ['region', 'forbiddenCharacter', 'Escolha um estado da lista.'],
    ['displayName', 'rejected', 'Confira o nome.'],
    ['bio', 'rejected', 'Confira a apresentação.'],
    ['birthDate', 'rejected', 'Confira a data de nascimento.'],
    ['region', 'rejected', 'Escolha um estado da lista.'],
  ] as const)('tells the %s problem "%s" in words', (field, problem, message) => {
    expect(problemMessage(field, problem)).toBe(message)
  })
})
