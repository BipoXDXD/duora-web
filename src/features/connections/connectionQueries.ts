/** Chaves do cache da decisão de cada rodada e da lista de conexões. */
export const CONNECTION_KEYS = {
  decision: (eventId: string, roundNumber: number) => ['decision', eventId, roundNumber] as const,
  list: ['connections'] as const,
}
