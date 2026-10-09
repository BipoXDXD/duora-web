const MS_PER_SECOND = 1000
const DOUBLING = 2

/** Quanto, em fração da espera, o espalhamento pode tirar e acrescentar. */
export interface Spread {
  readonly down: number
  readonly up: number
}

interface BackoffRule {
  /** A espera depois de zero falhas; dobra a cada falha seguida. */
  readonly intervalMs: number
  /** Teto da espera depois de falhas seguidas, antes do espalhamento. */
  readonly capMs: number
  readonly spread: Spread
}

/**
 * A espera antes de ler de novo depois de `failures` falhas seguidas (0 ou mais): o dobro a cada falha, com teto
 * e espalhamento, para os clientes que caíram ou abriram juntos não voltarem juntos, e nunca menos que o
 * `Retry-After`. `random` devolve um número em [0, 1).
 */
export function backoffDelayMs(
  rule: BackoffRule,
  failures: number,
  retryAfterSeconds: number | null,
  random: () => number,
): number {
  const backoff = Math.min(rule.intervalMs * DOUBLING ** failures, rule.capMs)
  const spread = backoff * (1 - rule.spread.down + (rule.spread.down + rule.spread.up) * random())
  return Math.max(spread, (retryAfterSeconds ?? 0) * MS_PER_SECOND)
}
