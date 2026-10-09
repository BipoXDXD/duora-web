import { characterCount } from '../../shared/text/characterCount.ts'
import type { NewEvent } from './adminEvents.ts'

export const EVENT_FIELDS = ['title', 'description', 'startsAt', 'endsAt', 'capacity'] as const

export type EventField = (typeof EVENT_FIELDS)[number]

export function isEventField(name: string): name is EventField {
  const known: readonly string[] = EVENT_FIELDS
  return known.includes(name)
}

/** O que está nos campos do formulário, como foi digitado; `''` para vazio. */
export interface EventFormValues {
  readonly title: string
  readonly description: string
  /** `AAAA-MM-DDThh:mm` no fuso de quem usa o app, como o `<input type="datetime-local">` entrega, ou `''`. */
  readonly startsAt: string
  readonly endsAt: string
  readonly capacity: string
}

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  capacity: '',
}

export type EventFieldProblem =
  | 'blank'
  | 'tooLong'
  | 'forbiddenCharacter'
  | 'notADate'
  | 'inThePast'
  | 'tooFarAhead'
  | 'notAfterStart'
  | 'durationTooLong'
  | 'notANumber'
  | 'belowMinimum'
  | 'aboveMaximum'
  | 'rejected'

export type EventFieldProblems = Readonly<Partial<Record<EventField, EventFieldProblem>>>

export type EventFormCheck =
  | { readonly kind: 'valid'; readonly event: NewEvent }
  | { readonly kind: 'invalid'; readonly problems: EventFieldProblems }

/** Os mesmos limites do domínio da duora-api (EventTitle, EventDescription, EventSchedule, Capacity e Event). */
export const TITLE_MAX_LENGTH = 80
export const DESCRIPTION_MAX_LENGTH = 500
export const MIN_CAPACITY = 2
export const MAX_CAPACITY = 200
export const MAX_DAYS_AHEAD = 365
export const MAX_DURATION_HOURS = 12

const MS_PER_HOUR = 3_600_000
const MAX_LEAD_MS = MAX_DAYS_AHEAD * 24 * MS_PER_HOUR
const MAX_DURATION_MS = MAX_DURATION_HOURS * MS_PER_HOUR
const MINUTES_PER_HOUR = 60

/** Controle, formatação invisível e espaço que não é o comum; o ZWJ (emojis compostos) fica de fora. */
const FORBIDDEN_IN_LINE = /(?!\u0020|\u200D)[\p{Cc}\p{Cf}\p{Z}]/u
/** Como `FORBIDDEN_IN_LINE`, mas aceita a quebra de linha entre parágrafos. */
const FORBIDDEN_IN_PARAGRAPHS = /(?!\u0020|\u200D|\n)[\p{Cc}\p{Cf}\p{Z}]/u

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const WHOLE_NUMBER = /^-?\d+$/

type Outcome<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'problem'; readonly problem: EventFieldProblem }

function ok<T>(value: T): Outcome<T> {
  return { kind: 'ok', value }
}

function problem(found: EventFieldProblem): Outcome<never> {
  return { kind: 'problem', problem: found }
}

/**
 * Confere o formulário com as regras da API e o devolve no formato do POST. As regras repetem as da API
 * para o erro aparecer antes de enviar; quem decide é a API. `now` é o instante em que a pessoa envia.
 * Os textos seguem a normalização da API (forma NFC, quebra de linha como `\n`, sem espaço nas pontas) e
 * vão já normalizados.
 */
export function checkEventForm(values: EventFormValues, now: Date): EventFormCheck {
  const title = checkText(values.title, TITLE_MAX_LENGTH, FORBIDDEN_IN_LINE)
  const description = checkText(values.description, DESCRIPTION_MAX_LENGTH, FORBIDDEN_IN_PARAGRAPHS)
  const { startsAt, endsAt } = checkSchedule(values.startsAt, values.endsAt, now)
  const capacity = checkCapacity(values.capacity)
  if (
    title.kind === 'ok' &&
    description.kind === 'ok' &&
    startsAt.kind === 'ok' &&
    endsAt.kind === 'ok' &&
    capacity.kind === 'ok'
  ) {
    const event: NewEvent = {
      title: title.value,
      description: description.value,
      startsAt: startsAt.value,
      endsAt: endsAt.value,
      capacity: capacity.value,
    }
    return { kind: 'valid', event }
  }
  const outcomes = { title, description, startsAt, endsAt, capacity }
  const problems: Partial<Record<EventField, EventFieldProblem>> = {}
  for (const field of EVENT_FIELDS) {
    const outcome = outcomes[field]
    if (outcome.kind === 'problem') {
      problems[field] = outcome.problem
    }
  }
  return { kind: 'invalid', problems }
}

interface Instant {
  readonly date: Date
  /** O mesmo instante em ISO 8601 com o fuso de quem digitou, como a API pede. */
  readonly iso: string
}

/**
 * Os dois horários. O início precisa cair entre agora e daqui a 365 dias; o fim, depois do início e a no
 * máximo 12 horas dele. O fim só é comparado com um início que existe.
 */
function checkSchedule(
  typedStart: string,
  typedEnd: string,
  now: Date,
): { readonly startsAt: Outcome<string>; readonly endsAt: Outcome<string> } {
  const start = checkInstant(typedStart)
  const end = checkInstant(typedEnd)
  return {
    startsAt: start.kind === 'ok' ? checkStart(start.value, now) : start,
    endsAt: start.kind === 'ok' && end.kind === 'ok' ? checkEnd(start.value, end.value) : mapIso(end),
  }
}

function checkStart(start: Instant, now: Date): Outcome<string> {
  const ahead = start.date.getTime() - now.getTime()
  if (ahead <= 0) {
    return problem('inThePast')
  }
  return ahead > MAX_LEAD_MS ? problem('tooFarAhead') : ok(start.iso)
}

function checkEnd(start: Instant, end: Instant): Outcome<string> {
  const duration = end.date.getTime() - start.date.getTime()
  if (duration <= 0) {
    return problem('notAfterStart')
  }
  return duration > MAX_DURATION_MS ? problem('durationTooLong') : ok(end.iso)
}

function mapIso(outcome: Outcome<Instant>): Outcome<string> {
  return outcome.kind === 'ok' ? ok(outcome.value.iso) : outcome
}

function normalizeText(text: string): string {
  return text.normalize('NFC').replaceAll('\r\n', '\n').trim()
}

function checkText(typed: string, maxLength: number, forbidden: RegExp): Outcome<string> {
  const text = normalizeText(typed)
  const length = characterCount(text)
  if (length < 1) {
    return problem('blank')
  }
  if (length > maxLength) {
    return problem('tooLong')
  }
  return forbidden.test(text) ? problem('forbiddenCharacter') : ok(text)
}

function checkCapacity(typed: string): Outcome<number> {
  const text = typed.trim()
  if (text === '') {
    return problem('blank')
  }
  if (!WHOLE_NUMBER.test(text)) {
    return problem('notANumber')
  }
  const places = Number(text)
  if (places < MIN_CAPACITY) {
    return problem('belowMinimum')
  }
  return places > MAX_CAPACITY ? problem('aboveMaximum') : ok(places)
}

function checkInstant(typed: string): Outcome<Instant> {
  if (typed === '') {
    return problem('blank')
  }
  const date = parseLocalDateTime(typed)
  return date === null ? problem('notADate') : ok({ date, iso: toIsoWithOffset(typed, date) })
}

/**
 * `AAAA-MM-DDThh:mm` no fuso do navegador como instante, ou `null` se a data não existe: dia 31 de
 * fevereiro ou uma hora que o horário de verão pula.
 */
function parseLocalDateTime(local: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(local)
  if (match === null) {
    return null
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined) {
    return null
  }
  const date = new Date(year, month - 1, day, hour, minute)
  const exists =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  return exists ? date : null
}

/** `2026-10-10T19:00` às 19:00 em Brasília vira `2026-10-10T19:00:00-03:00`. */
function toIsoWithOffset(local: string, date: Date): string {
  return `${local}:00${formatOffset(-date.getTimezoneOffset())}`
}

/** O deslocamento em relação ao UTC, como `-03:00` ou `+05:30`; `minutesEastOfUtc` é positivo a leste. */
export function formatOffset(minutesEastOfUtc: number): string {
  const sign = minutesEastOfUtc < 0 ? '-' : '+'
  const absolute = Math.abs(minutesEastOfUtc)
  const hours = String(Math.floor(absolute / MINUTES_PER_HOUR)).padStart(2, '0')
  const minutes = String(absolute % MINUTES_PER_HOUR).padStart(2, '0')
  return `${sign}${hours}:${minutes}`
}

/** O fuso em que os horários do formulário valem, como `America/Sao_Paulo`, para a tela dizer qual é. */
export function userTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}
