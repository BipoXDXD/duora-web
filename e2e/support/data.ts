import type {
  AdminEventResponse,
  ChatMessageResponse,
  CurrentUserResponse,
  EventResponse,
  ProfileResponse,
  RegistrationResponse,
} from '../../src/shared/api/contract.ts'

/** Os ids são fixos para os caminhos das rotas ficarem legíveis nos testes. */
export const EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-000000000007'
export const PARTNER_ID = '0199b0c4-7f3a-7c2e-9a1b-00000000a321'
export const CHAT_ID = '0199b0c4-7f3a-7c2e-9a1b-0000000000c1'
export const ADMIN_EVENT_ID = '0199b0c4-7f3a-7c2e-9a1b-0000000000ad'

/** Os últimos 8 caracteres do id da dupla, que a tela mostra como "conta ...". */
export const PARTNER_CODE = '0000a321'

const MS_PER_MINUTE = 60_000
const MS_PER_HOUR = 3_600_000

/** O instante `ms` depois de agora (ou antes, se negativo), em ISO 8601, como a API manda. */
export function fromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

export const minutes = (count: number): number => count * MS_PER_MINUTE
export const hours = (count: number): number => count * MS_PER_HOUR

export function aSession(overrides: Partial<CurrentUserResponse> = {}): CurrentUserResponse {
  return { displayName: 'Ana Souza', profileComplete: true, roles: [], ...overrides }
}

/** Um evento publicado que começa em duas horas. */
export function anUpcomingEvent(overrides: Partial<EventResponse> = {}): EventResponse {
  return {
    id: EVENT_ID,
    title: 'Jantar às cegas',
    description: 'Uma noite de jogos de mesa.',
    startsAt: fromNow(hours(2)),
    endsAt: fromNow(hours(5)),
    status: 'PUBLISHED',
    currentRound: null,
    ...overrides,
  }
}

/** Um evento publicado que começou há uma hora, na primeira rodada. */
export function anEventInProgress(overrides: Partial<EventResponse> = {}): EventResponse {
  return anUpcomingEvent({ startsAt: fromNow(-hours(1)), endsAt: fromNow(hours(2)), currentRound: 1, ...overrides })
}

export function aRegistration(overrides: Partial<RegistrationResponse> = {}): RegistrationResponse {
  return { eventId: EVENT_ID, registeredAt: fromNow(-hours(24)), ...overrides }
}

export function aMessage(
  seq: number,
  fromMe: boolean,
  text: string,
  overrides: Partial<ChatMessageResponse> = {},
): ChatMessageResponse {
  return { seq, fromMe, text, sentAt: fromNow(-minutes(30) + seq * MS_PER_MINUTE), ...overrides }
}

export function aProfile(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    displayName: 'Ana Souza',
    birthDate: '1995-04-12',
    region: 'BR-SP',
    bio: 'Gosto de jogos de tabuleiro.',
    complete: true,
    ...overrides,
  }
}

export function anAdminEvent(overrides: Partial<AdminEventResponse> = {}): AdminEventResponse {
  return {
    id: ADMIN_EVENT_ID,
    title: 'Noite de jogos',
    description: 'Mesa de jogos para quem chega sozinho.',
    startsAt: fromNow(hours(48)),
    endsAt: fromNow(hours(51)),
    status: 'PUBLISHED',
    capacity: 40,
    registrationCount: 12,
    ...overrides,
  }
}
