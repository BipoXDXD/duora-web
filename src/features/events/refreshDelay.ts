/** Intervalo da releitura do evento em andamento, com a aba visível. */
export const EVENT_REFRESH_INTERVAL_MS = 15_000

/** Teto da espera depois de falhas seguidas, antes do espalhamento. */
export const MAX_REFRESH_BACKOFF_MS = 120_000

/** Para mais ou para menos, sorteado, para os clientes que abriram juntos não lerem juntos. */
const JITTER = 0.2
const MS_PER_SECOND = 1000

/**
 * A espera antes de ler o evento de novo. Sem falha, o intervalo normal; depois de `failures` falhas seguidas, o
 * dobro a cada uma, com teto. Em toda espera, até 20% a mais ou a menos, e nunca menos que o `Retry-After`.
 * `random` devolve um número em [0, 1).
 */
export function refreshDelayMs(failures: number, retryAfterSeconds: number | null, random: () => number): number {
  const base =
    failures === 0
      ? EVENT_REFRESH_INTERVAL_MS
      : Math.min(EVENT_REFRESH_INTERVAL_MS * 2 ** failures, MAX_REFRESH_BACKOFF_MS)
  const spread = base * (1 - JITTER + 2 * JITTER * random())
  return Math.max(spread, (retryAfterSeconds ?? 0) * MS_PER_SECOND)
}
