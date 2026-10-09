/** Chaves do cache da área da equipe; o resultado da leitura do evento inclui as falhas esperadas (403, 404). */
export const ADMIN_KEYS = {
  event: (eventId: string) => ['admin-event', eventId] as const,
  round: (eventId: string, number: number) => ['admin-round', eventId, number] as const,
}
