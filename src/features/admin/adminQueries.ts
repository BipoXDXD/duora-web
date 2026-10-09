import type { AdminEventStatus } from './adminEvents.ts'

/** Chaves do cache da área da equipe. O resultado da leitura de um evento inclui as falhas esperadas (403, 404); a lista é paginada e deixa a falha subir. */
export const ADMIN_KEYS = {
  /** Toda lista, de qualquer filtro: criar, publicar ou cancelar um evento muda o que elas mostram. */
  lists: ['admin-events'] as const,
  list: (status: AdminEventStatus | null) => ['admin-events', status ?? 'all'] as const,
  event: (eventId: string) => ['admin-event', eventId] as const,
  round: (eventId: string, number: number) => ['admin-round', eventId, number] as const,
}
