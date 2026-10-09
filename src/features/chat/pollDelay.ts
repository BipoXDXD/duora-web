/** Intervalo da leitura com a aba visível (ADR 0021 da duora-api: polling a cada 2 s, SSE depois). */
export const POLL_INTERVAL_MS = 2000

/** Teto da espera depois de falhas seguidas, antes do espalhamento. */
export const MAX_RETRY_DELAY_MS = 30_000

/** Até um quinto a mais, sorteado, para os clientes que caíram juntos não voltarem juntos. */
const JITTER = 0.2
const MS_PER_SECOND = 1000

/**
 * A espera antes de ler de novo depois de `failures` falhas seguidas (1 ou mais): o dobro a cada falha, com
 * teto e espalhamento, e nunca menos que o `Retry-After`. `random` devolve um número em [0, 1).
 */
export function retryDelayMs(failures: number, retryAfterSeconds: number | null, random: () => number): number {
  const backoff = Math.min(POLL_INTERVAL_MS * 2 ** failures, MAX_RETRY_DELAY_MS)
  const spread = backoff * (1 + JITTER * random())
  return Math.max(spread, (retryAfterSeconds ?? 0) * MS_PER_SECOND)
}
