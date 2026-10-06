import { describe, expect, it } from 'vitest'
import { readThemeTokens } from './themeTokens.ts'

const CSS = `
@import "tailwindcss";

/* comentário com --color-fake: red; que não conta */
@theme {
  --color-*: initial;
  --color-ink-50: oklch(0.98 0.01 265);
  --color-ink-900: oklch(0.2 0.03 265);
  --color-fg: var(--color-ink-900);
  --color-canvas: var(--color-ink-50);
  --shadow-raised: 0 1px 3px oklch(0 0 0 / 0.2);
}

@layer base {
  @media (prefers-color-scheme: dark) {
    :root {
      --color-fg: var(--color-ink-50);
      --shadow-raised: none;
    }
  }
}
`

describe('readThemeTokens', () => {
  it('resolves the light value of a semantic token through var()', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.light.get('--color-fg')).toBe('oklch(0.2 0.03 265)')
  })

  it('applies the dark overrides on top of the light theme', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.dark.get('--color-fg')).toBe('oklch(0.98 0.01 265)')
    expect(tokens.dark.get('--color-canvas')).toBe('oklch(0.98 0.01 265)')
    expect(tokens.dark.get('--shadow-raised')).toBe('none')
  })

  it('ignores comments and the reset of the default palette', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.light.has('--color-fake')).toBe(false)
    expect([...tokens.light.keys()]).not.toContain('--color-*')
  })

  it('fails loudly when a token points to an undefined variable', () => {
    const broken = '@theme { --color-fg: var(--color-missing); }'

    expect(() => readThemeTokens(broken)).toThrow('--color-fg aponta para --color-missing, que não existe')
  })

  it('fails loudly when the CSS has no @theme block', () => {
    expect(() => readThemeTokens(':root { --x: 1px; }')).toThrow('bloco @theme não encontrado')
  })
})
