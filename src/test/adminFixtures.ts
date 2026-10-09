import { DINNER_BLURB } from './eventFixtures.ts'

/** Eventos como o GET /api/admin/events/{id} os manda, para os testes das telas da equipe. */
export const ADMIN_DRAFT = {
  id: '0199b0c4-7f3a-7c2e-9a1b-2c3d4e5f6a7b',
  title: 'Jantar às cegas',
  description: `${DINNER_BLURB}\nTraga sua curiosidade.`,
  startsAt: '2026-10-10T22:00:00Z',
  endsAt: '2026-10-11T01:00:00Z',
  status: 'DRAFT',
  capacity: 40,
  registrationCount: 0,
} as const

export const ADMIN_PUBLISHED = { ...ADMIN_DRAFT, status: 'PUBLISHED', registrationCount: 12 } as const

export const ADMIN_CANCELLED = { ...ADMIN_DRAFT, status: 'CANCELLED', registrationCount: 12 } as const

/** Antes do jantar (19:00 às 22:00 em Brasília): 2026-10-08 12:00. */
export const BEFORE_DINNER = new Date('2026-10-08T15:00:00Z')

/** Durante o jantar. */
export const DURING_DINNER = new Date('2026-10-10T23:00:00Z')

/** Depois do jantar. */
export const AFTER_DINNER = new Date('2026-10-11T02:00:00Z')

/** O que o GET/PUT de uma rodada devolve (AdminRoundResponse). */
export function adminRound(number: number, pairCount = 5, sittingOutCount = 2) {
  return {
    eventId: ADMIN_DRAFT.id,
    number,
    pairCount,
    sittingOutCount,
    startedAt: '2026-10-10T23:15:00Z',
  } as const
}
