import type { AdminEvent, AdminEventStatus, AdminPhase, AdminRound } from './adminEvents.ts'
import {
  DESCRIPTION_MAX_LENGTH,
  MAX_CAPACITY,
  MAX_DAYS_AHEAD,
  MAX_DURATION_HOURS,
  MIN_CAPACITY,
  TITLE_MAX_LENGTH,
  type EventField,
  type EventFieldProblem,
} from './adminEventForm.ts'

/** O que a API responde a quem não é ADMIN (403). O front não sabe o papel; quem decide é a API. */
export const STAFF_ONLY_TEXT = 'Área só para a equipe.'

/** O que cada problema quer dizer em cada campo; o que não está aqui cai em `REJECTED`. */
const MESSAGES: Readonly<Record<EventField, Readonly<Partial<Record<EventFieldProblem, string>>>>> = {
  title: {
    blank: 'Dê um título ao evento.',
    tooLong: `Use no máximo ${TITLE_MAX_LENGTH} caracteres.`,
    forbiddenCharacter: 'Use uma linha só, sem caracteres invisíveis.',
  },
  description: {
    blank: 'Descreva o evento.',
    tooLong: `Use no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`,
    forbiddenCharacter: 'A descrição tem caracteres que não são aceitos. Separe os parágrafos só com quebras de linha.',
  },
  startsAt: {
    blank: 'Informe quando o evento começa.',
    notADate: 'Informe um dia e uma hora que existam.',
    inThePast: 'O início precisa ser no futuro.',
    tooFarAhead: `O início pode ser em até ${MAX_DAYS_AHEAD} dias.`,
  },
  endsAt: {
    blank: 'Informe quando o evento termina.',
    notADate: 'Informe um dia e uma hora que existam.',
    notAfterStart: 'O fim precisa ser depois do início.',
    durationTooLong: `O evento pode durar no máximo ${MAX_DURATION_HOURS} horas.`,
  },
  capacity: {
    blank: 'Informe quantas pessoas podem se inscrever.',
    notANumber: 'Use só números inteiros, como 40.',
    belowMinimum: `A capacidade mínima é de ${MIN_CAPACITY} pessoas.`,
    aboveMaximum: `A capacidade máxima é de ${MAX_CAPACITY} pessoas.`,
  },
}

/** O que a API recusou por um motivo que o front não distingue: só diz qual campo conferir. */
const REJECTED: Readonly<Record<EventField, string>> = {
  title: 'Confira o título.',
  description: 'Confira a descrição.',
  startsAt: 'Confira o início.',
  endsAt: 'Confira o fim.',
  capacity: 'Confira a capacidade.',
}

export function problemMessage(field: EventField, problem: EventFieldProblem): string {
  return MESSAGES[field][problem] ?? REJECTED[field]
}

/** A etiqueta de cada fase para a equipe, em texto: o rascunho e o publicado que ainda vai começar também têm uma. */
export const ADMIN_PHASE_LABELS: Readonly<Record<AdminPhase, string>> = {
  draft: 'Rascunho',
  upcoming: 'Publicado',
  inProgress: 'Em andamento',
  ended: 'Encerrado',
  cancelled: 'Cancelado',
}

/** "1 par" ou "12 pares". */
function pairsText(count: number): string {
  return count === 1 ? '1 par' : `${count} pares`
}

/** "1 pessoa ficou de fora" ou "3 pessoas ficaram de fora". */
function sittingOutText(count: number): string {
  return count === 1 ? '1 pessoa ficou de fora' : `${count} pessoas ficaram de fora`
}

/** O resultado da rodada, só em contagens: a API nunca diz quem. */
export function roundCountsText(round: Pick<AdminRound, 'pairCount' | 'sittingOutCount'>): string {
  return `${pairsText(round.pairCount)}; ${sittingOutText(round.sittingOutCount)}.`
}

/** "3 pessoas inscritas de 40 vagas.": só a contagem, a API nunca diz quem. */
export function registrationText(event: Pick<AdminEvent, 'registrationCount' | 'capacity'>): string {
  const count = event.registrationCount
  const people = count === 1 ? '1 pessoa inscrita' : `${count} pessoas inscritas`
  return `${people} de ${event.capacity} vagas.`
}

/** O que o filtro da lista oferece: um estado guardado ou todos. */
export const STATUS_FILTER_LABELS: Readonly<Record<AdminEventStatus, string>> = {
  DRAFT: 'Rascunhos',
  PUBLISHED: 'Publicados',
  CANCELLED: 'Cancelados',
}

export const ALL_STATUSES_LABEL = 'Todos'
