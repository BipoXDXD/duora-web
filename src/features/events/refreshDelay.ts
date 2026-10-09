import { backoffDelayMs } from '../../shared/api/backoffDelay.ts'

/** Intervalo da releitura do evento em andamento, com a aba visível. */
export const EVENT_REFRESH_INTERVAL_MS = 15_000

/** Teto da espera depois de falhas seguidas, antes do espalhamento. */
export const MAX_REFRESH_BACKOFF_MS = 120_000

/** Para mais ou para menos, sorteado, em toda espera: os clientes que abriram juntos não leem juntos. */
const REFRESH_BACKOFF = {
  intervalMs: EVENT_REFRESH_INTERVAL_MS,
  capMs: MAX_REFRESH_BACKOFF_MS,
  spread: { down: 0.2, up: 0.2 },
} as const

/**
 * A espera antes de ler o evento de novo. Sem falha, o intervalo normal; depois de `failures` falhas seguidas, o
 * dobro a cada uma, com teto. Em toda espera, até 20% a mais ou a menos, e nunca menos que o `Retry-After`.
 * `random` devolve um número em [0, 1).
 */
export function refreshDelayMs(failures: number, retryAfterSeconds: number | null, random: () => number): number {
  return backoffDelayMs(REFRESH_BACKOFF, failures, retryAfterSeconds, random)
}
