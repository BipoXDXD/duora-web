import { vi } from 'vitest'

/**
 * O jsdom não implementa matchMedia. Este fake responde `initiallyMatches` a qualquer query, valor que o
 * teste pode trocar depois, exceto as queries de `fixedAnswers`, que respondem sempre o valor dado.
 */
export interface FakeMediaQuery {
  setMatches(matches: boolean): void
}

export function stubMatchMedia(
  initiallyMatches: boolean,
  fixedAnswers: Readonly<Record<string, boolean>> = {},
): FakeMediaQuery {
  let matches = initiallyMatches
  const listeners = new Set<() => void>()

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return fixedAnswers[query] ?? matches
    },
    media: query,
    addEventListener: (_type: 'change', listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: 'change', listener: () => void) => listeners.delete(listener),
  }))

  return {
    setMatches(next) {
      matches = next
      listeners.forEach((listener) => listener())
    },
  }
}
