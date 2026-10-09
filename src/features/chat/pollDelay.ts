import { backoffDelayMs } from '../../shared/api/backoffDelay.ts'

/** Intervalo da leitura com a aba visível (ADR 0021 da duora-api: polling a cada 2 s, SSE depois). */
export const POLL_INTERVAL_MS = 2000

/** Teto da espera depois de falhas seguidas, antes do espalhamento. */
export const MAX_RETRY_DELAY_MS = 30_000

/** Até um quinto a mais, sorteado, e nunca a menos: a espera de uma falha nunca fica abaixo do dobro do polling. */
const POLL_BACKOFF = {
  intervalMs: POLL_INTERVAL_MS,
  capMs: MAX_RETRY_DELAY_MS,
  spread: { down: 0, up: 0.2 },
} as const

/**
 * A espera antes de ler de novo depois de `failures` falhas seguidas (1 ou mais): o dobro a cada falha, com
 * teto e espalhamento, e nunca menos que o `Retry-After`. `random` devolve um número em [0, 1).
 */
export function retryDelayMs(failures: number, retryAfterSeconds: number | null, random: () => number): number {
  return backoffDelayMs(POLL_BACKOFF, failures, retryAfterSeconds, random)
}
