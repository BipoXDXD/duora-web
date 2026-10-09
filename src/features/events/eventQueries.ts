/** Chaves do cache dos eventos; inscrever ou cancelar invalida as inscrições da pessoa. */
export const EVENT_KEYS = {
  list: ['events'] as const,
  event: (eventId: string) => ['event', eventId] as const,
  registration: (eventId: string) => ['registration', eventId] as const,
  myRegistrations: ['my-registrations'] as const,
  pairing: (eventId: string, roundNumber: number) => ['pairing', eventId, roundNumber] as const,
}
