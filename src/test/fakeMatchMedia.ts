import { vi } from 'vitest'

/** O jsdom não implementa matchMedia. Este fake responde a uma única query e permite trocar o resultado. */
export interface FakeMediaQuery {
  setMatches(matches: boolean): void
}

export function stubMatchMedia(initiallyMatches: boolean): FakeMediaQuery {
  let matches = initiallyMatches
  const listeners = new Set<() => void>()

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matches
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
