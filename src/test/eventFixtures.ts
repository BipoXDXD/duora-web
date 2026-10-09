import { jsonAnswer, type FakeRoute } from './fakeApi.ts'

/** Eventos como a API os manda, para os testes das telas de eventos. */
export const DINNER = {
  id: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b',
  title: 'Jantar às cegas',
  description: 'Uma noite de jogos de mesa.\nTraga sua curiosidade.',
  startsAt: '2026-10-10T22:00:00Z',
  endsAt: '2026-10-11T01:00:00Z',
  status: 'PUBLISHED',
  currentRound: null,
} as const

export const WINE = {
  id: '0199a1d2-1111-7aaa-8bbb-cccccccccccc',
  title: 'Vinho e cartas',
  description: 'Degustação com perguntas.',
  startsAt: '2026-10-17T22:00:00Z',
  endsAt: '2026-10-18T01:00:00Z',
  status: 'PUBLISHED',
  currentRound: null,
} as const

export const PICNIC = {
  id: '01989f00-2222-7ddd-8eee-ffffffffffff',
  title: 'Piquenique no parque',
  description: 'Jogos ao ar livre.',
  startsAt: '2026-10-24T15:00:00Z',
  endsAt: '2026-10-24T18:00:00Z',
  status: 'PUBLISHED',
  currentRound: null,
} as const

export const SESSION = { '/api/me': jsonAnswer({ displayName: 'Ana Souza', profileComplete: true, roles: [] }) }

/** Antes de todos os eventos acima: 2026-10-08 12:00 em Brasília. */
export const BEFORE_EVENTS = new Date('2026-10-08T15:00:00Z')

export function pageOf(items: readonly object[], nextPageToken: string | null = null) {
  return jsonAnswer({ items, nextPageToken })
}

/**
 * O chat aberto e vazio de uma rodada do jantar, para as telas que mostram a dupla da rodada atual sem testar a
 * conversa: o painel do chat lê as duas rotas assim que aparece.
 */
export function emptyChatRoutes(roundNumber: number): Record<string, FakeRoute> {
  const chat = `/api/events/${DINNER.id}/rounds/${roundNumber}/chat`
  return {
    [chat]: jsonAnswer({ chatId: '0199b0c4-7f3a-7c2e-9a1b-00000000c4a7', open: true, lastSeq: 0 }),
    [`${chat}/messages?afterSeq=0&maxPageSize=100`]: jsonAnswer({ items: [], nextAfterSeq: null }),
  }
}
