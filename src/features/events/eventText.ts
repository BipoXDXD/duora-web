import { FIRST_ROUND, LAST_ROUND } from './pairing.ts'
import type { EventPhase } from './events.ts'

/** Sem `timeZone`: o Intl usa o fuso de quem está com o app aberto. */
const EVENT_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const DAY_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })

/** "sábado, 10 de outubro 19:00 – 22:00"; o dia do fim só aparece quando é outro. */
export function formatEventTime(startsAt: Date, endsAt: Date): string {
  return EVENT_TIME_FORMAT.formatRange(startsAt, endsAt)
}

export function formatDay(instant: Date): string {
  return DAY_FORMAT.format(instant)
}

/** A etiqueta de cada fase; o evento que ainda vai começar não precisa de uma. */
export const PHASE_LABELS: Readonly<Record<EventPhase, string | null>> = {
  upcoming: null,
  inProgress: 'Em andamento',
  ended: 'Encerrado',
  cancelled: 'Cancelado',
}

/** A API não manda o nome da dupla; o fim do id (aleatório no UUIDv7) distingue uma conta da outra. */
const ACCOUNT_CODE_LENGTH = 8

export function accountCode(accountId: string): string {
  return accountId.slice(-ACCOUNT_CODE_LENGTH)
}

const WHOLE_NUMBER = /^\d+$/

/** O número da rodada digitado, ou `null` fora de 1 a 100, a faixa que a API aceita. */
export function parseRoundNumber(text: string): number | null {
  const trimmed = text.trim()
  if (!WHOLE_NUMBER.test(trimmed)) {
    return null
  }
  const round = Number(trimmed)
  return round >= FIRST_ROUND && round <= LAST_ROUND ? round : null
}
