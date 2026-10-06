/**
 * Lê os tokens do tema direto do `index.css`, a fonte única deles, para os testes não repetirem valores.
 * Entende só o formato que o arquivo usa: as declarações do `@theme` (tema claro) e as sobrescritas do
 * `:root` dentro de `@media (prefers-color-scheme: dark)`.
 */
export interface ThemeTokens {
  readonly light: ReadonlyMap<string, string>
  readonly dark: ReadonlyMap<string, string>
}

const DARK_MEDIA = '@media (prefers-color-scheme: dark)'
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g
const VAR_REFERENCE = /^var\((--[\w-]+)\)$/

export function readThemeTokens(css: string): ThemeTokens {
  const source = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const theme = blockAfter(source, '@theme')
  if (theme === undefined) {
    throw new Error('bloco @theme não encontrado')
  }
  const lightDeclarations = declarationsIn(theme)
  const darkMedia = blockAfter(source, DARK_MEDIA)
  const darkDeclarations = declarationsIn(darkMedia === undefined ? '' : (blockAfter(darkMedia, ':root') ?? ''))

  return {
    light: resolveAll(lightDeclarations),
    dark: resolveAll(new Map([...lightDeclarations, ...darkDeclarations])),
  }
}

/** Conteúdo entre as chaves do primeiro bloco que começa em `opener`, ou `undefined` se não houver. */
function blockAfter(source: string, opener: string): string | undefined {
  const start = source.indexOf(opener)
  const open = start === -1 ? -1 : source.indexOf('{', start)
  if (open === -1) {
    return undefined
  }
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === '{') {
      depth++
    } else if (source[index] === '}') {
      depth--
      if (depth === 0) {
        return source.slice(open + 1, index)
      }
    }
  }
  throw new Error(`bloco ${opener} sem fechamento`)
}

function declarationsIn(block: string): Map<string, string> {
  return new Map([...block.matchAll(DECLARATION)].map(([, name = '', value = '']) => [name, value.trim()]))
}

function resolveAll(declarations: ReadonlyMap<string, string>): Map<string, string> {
  return new Map([...declarations.keys()].map((name) => [name, resolve(name, declarations)]))
}

function resolve(name: string, declarations: ReadonlyMap<string, string>): string {
  const value = declarations.get(name) ?? ''
  const reference = VAR_REFERENCE.exec(value)?.[1]
  if (reference === undefined) {
    return value
  }
  if (!declarations.has(reference)) {
    throw new Error(`${name} aponta para ${reference}, que não existe`)
  }
  return resolve(reference, declarations)
}
