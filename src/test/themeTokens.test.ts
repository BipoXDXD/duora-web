import { describe, expect, it } from 'vitest'
import { readThemeTokens } from './themeTokens.ts'

const CSS = `
@import "tailwindcss";

/* comentário com --color-fake: red; que não conta */
@theme {
  --color-*: initial;
  --color-ink-50: oklch(0.98 0.01 330);
  --color-ink-900: oklch(0.2 0.03 330);
  --color-fg: light-dark(var(--color-ink-900), var(--color-ink-50));
  --color-canvas: var(--color-ink-50);
  --elevation-raised: 0 1px 3px light-dark(oklch(0 0 0 / 0.2), transparent), 0 1px 2px var(--color-fg);
}

@layer base {
  :root {
    color-scheme: dark light;
  }
}
`

describe('readThemeTokens', () => {
  it('takes the first light-dark() argument for the light theme, resolving var()', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.light.get('--color-fg')).toBe('oklch(0.2 0.03 330)')
  })

  it('takes the second light-dark() argument for the dark theme, resolving var()', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.dark.get('--color-fg')).toBe('oklch(0.98 0.01 330)')
  })

  it('gives a token without light-dark() the same value in both themes', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.light.get('--color-canvas')).toBe('oklch(0.98 0.01 330)')
    expect(tokens.dark.get('--color-canvas')).toBe('oklch(0.98 0.01 330)')
  })

  it('resolves light-dark() and var() inside a longer value, such as a shadow', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.light.get('--elevation-raised')).toBe('0 1px 3px oklch(0 0 0 / 0.2), 0 1px 2px oklch(0.2 0.03 330)')
    expect(tokens.dark.get('--elevation-raised')).toBe('0 1px 3px transparent, 0 1px 2px oklch(0.98 0.01 330)')
  })

  it('reads the tokens of every @theme block, including @theme inline', () => {
    const split = `
      @theme { --color-ink-50: oklch(0.98 0.01 330); }
      @utility grain { --color-fake: red; }
      @theme inline { --color-canvas: var(--color-ink-50); }
    `

    const tokens = readThemeTokens(split)

    expect(tokens.dark.get('--color-canvas')).toBe('oklch(0.98 0.01 330)')
    expect(tokens.dark.has('--color-fake')).toBe(false)
  })

  it('ignores comments and the reset of the default palette', () => {
    const tokens = readThemeTokens(CSS)

    expect(tokens.light.has('--color-fake')).toBe(false)
    expect([...tokens.light.keys()]).not.toContain('--color-*')
  })

  it('fails loudly when a token points to an undefined variable', () => {
    const broken = '@theme { --color-fg: light-dark(var(--color-missing), red); }'

    expect(() => readThemeTokens(broken)).toThrow('--color-fg aponta para --color-missing, que não existe')
  })

  it('fails loudly when light-dark() does not have exactly two arguments', () => {
    const broken = '@theme { --color-fg: light-dark(red); }'

    expect(() => readThemeTokens(broken)).toThrow('--color-fg: light-dark() precisa de dois argumentos')
  })

  it('fails loudly when the CSS has no @theme block', () => {
    expect(() => readThemeTokens(':root { --x: 1px; }')).toThrow('bloco @theme não encontrado')
  })
})
