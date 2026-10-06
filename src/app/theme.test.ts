import { displayable, oklch, parse, wcagContrast } from 'culori'
import { describe, expect, it } from 'vitest'
import { readThemeTokens } from '../test/themeTokens.ts'
import css from '../index.css?raw'

/** WCAG 2.2: 1.4.3 (texto), 1.4.3 para texto grande (24px, ou 18,66px em negrito), 1.4.11 (UI e foco). */
const MINIMUM_RATIO = { text: 4.5, largeText: 3, ui: 3 } as const

type PairKind = keyof typeof MINIMUM_RATIO

interface ColorPair {
  readonly foreground: string
  readonly background: string
  readonly kind: PairKind
  readonly usage: string
}

/** Cada combinação que os componentes desenham. Token novo entra aqui ou em DECORATIVE_TOKENS. */
const PAIRS: readonly ColorPair[] = [
  { foreground: 'fg', background: 'canvas', kind: 'text', usage: 'título, texto e label' },
  { foreground: 'fg', background: 'canvas', kind: 'largeText', usage: 'título da página' },
  { foreground: 'fg', background: 'surface', kind: 'text', usage: 'texto digitado no campo' },
  { foreground: 'fg-muted', background: 'canvas', kind: 'text', usage: 'texto de apoio' },
  { foreground: 'fg-muted', background: 'surface', kind: 'text', usage: 'link inativo do cabeçalho' },
  { foreground: 'fg-accent', background: 'surface', kind: 'largeText', usage: 'marca no cabeçalho' },
  { foreground: 'fg-accent', background: 'surface', kind: 'text', usage: 'aba ativa da barra inferior' },
  { foreground: 'on-primary', background: 'primary', kind: 'text', usage: 'botão primário' },
  { foreground: 'on-primary', background: 'primary-hover', kind: 'text', usage: 'botão primário com hover' },
  { foreground: 'on-primary-subtle', background: 'primary-subtle', kind: 'text', usage: 'confirmação da inscrição' },
  { foreground: 'on-disabled', background: 'disabled', kind: 'text', usage: 'botão desabilitado ("Enviando…")' },
  { foreground: 'danger', background: 'canvas', kind: 'text', usage: 'mensagem de erro' },
  { foreground: 'primary', background: 'canvas', kind: 'ui', usage: 'limite do botão primário' },
  { foreground: 'primary', background: 'surface', kind: 'ui', usage: 'limite do botão no cabeçalho' },
  { foreground: 'edge', background: 'surface', kind: 'ui', usage: 'borda do campo' },
  { foreground: 'edge', background: 'canvas', kind: 'ui', usage: 'borda do campo contra a página' },
  { foreground: 'danger', background: 'surface', kind: 'ui', usage: 'borda do campo inválido' },
  { foreground: 'focus', background: 'canvas', kind: 'ui', usage: 'anel de foco na página' },
  { foreground: 'focus', background: 'surface', kind: 'ui', usage: 'anel de foco no cabeçalho e na barra' },
]

/** Sem exigência de contraste: separadores que não identificam nenhum componente (WCAG 1.4.11). */
const DECORATIVE_TOKENS = new Set(['divider'])

/** Classe de cor que aponta para um tom cru (`bg-brand-600`) ou para a paleta padrão (`text-white`). */
const RAW_COLOR_CLASS =
  /(?:^|[\s"'`:])((?:bg|text|border(?:-[trblxy])?|outline|ring|fill|stroke|decoration|accent|caret|divide|placeholder|shadow)-(?:[a-z]+-\d{2,3}|white|black))\b/g

const COMPONENT_SOURCES = import.meta.glob<string>(['../**/*.tsx', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

const THEMES = readThemeTokens(css)
/** Sombra transparente de tamanho zero, o valor inicial que o Tailwind usa para "sem sombra". */
const NO_SHADOW = '0 0 #0000'
const RAW_TONE = /^--color-[a-z]+-\d+$/

function colorToken(name: string): string {
  return `--color-${name}`
}

function semanticColorNames(tokens: ReadonlyMap<string, string>): string[] {
  return [...tokens.keys()]
    .filter((name) => name.startsWith('--color-') && !RAW_TONE.test(name))
    .map((name) => name.slice('--color-'.length))
}

const cases = (['light', 'dark'] as const).flatMap((theme) => PAIRS.map((pair) => ({ theme, ...pair })))

describe('theme tokens', () => {
  it.each(cases)(
    '$theme: $foreground on $background reaches the $kind minimum ($usage)',
    ({ theme, foreground, background, kind }) => {
      const tokens = THEMES[theme]
      const foregroundColor = tokens.get(colorToken(foreground))
      const backgroundColor = tokens.get(colorToken(background))
      if (foregroundColor === undefined || backgroundColor === undefined) {
        throw new Error(`token ausente: ${foreground} ou ${background}`)
      }

      expect(wcagContrast(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(MINIMUM_RATIO[kind])
    },
  )

  it('lets components use only semantic colors, so every color they draw is in PAIRS', () => {
    const rawUses = Object.entries(COMPONENT_SOURCES).flatMap(([file, source]) =>
      [...source.matchAll(RAW_COLOR_CLASS)].map((match) => `${file}: ${match[1] ?? ''}`),
    )

    expect(Object.keys(COMPONENT_SOURCES).length).toBeGreaterThan(0)
    expect(rawUses).toEqual([])
  })

  it('checks every semantic color in some pair or marks it as decorative', () => {
    const covered = new Set([...PAIRS.flatMap((pair) => [pair.foreground, pair.background]), ...DECORATIVE_TOKENS])

    expect(semanticColorNames(THEMES.light).filter((name) => !covered.has(name))).toEqual([])
  })

  it.each(['light', 'dark'] as const)('%s: every color fits the sRGB gamut, so no browser clips it', (theme) => {
    const outOfGamut = [...THEMES[theme]]
      .filter(([name]) => name.startsWith('--color-'))
      .filter(([, value]) => !displayable(parse(value) ?? 'invalid'))

    expect(outOfGamut).toEqual([])
  })

  it('dark: raised surfaces are lighter than the page, replacing the shadow', () => {
    const lightness = (name: string) => oklch(THEMES.dark.get(colorToken(name)) ?? 'invalid')?.l ?? Number.NaN

    expect(lightness('surface')).toBeGreaterThan(lightness('canvas'))
    expect(THEMES.dark.get('--shadow-raised')).toBe(NO_SHADOW)
  })
})
