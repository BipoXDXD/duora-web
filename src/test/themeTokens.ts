/**
 * Lê os tokens do tema direto do `index.css`, a fonte única deles, para os testes não repetirem valores.
 * Entende só o formato que o arquivo usa: declarações no bloco `@theme`, em que um token que muda com o
 * tema escreve os dois valores em `light-dark(claro, escuro)`. O resultado já vem com `var()` resolvido.
 */
export interface ThemeTokens {
  readonly light: ReadonlyMap<string, string>
  readonly dark: ReadonlyMap<string, string>
}

type Theme = keyof ThemeTokens

const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g
const VAR_REFERENCE = /var\((--[\w-]+)\)/g
const LIGHT_DARK = 'light-dark('

export function readThemeTokens(css: string): ThemeTokens {
  const source = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  const theme = blockAfter(source, '@theme')
  if (theme === undefined) {
    throw new Error('bloco @theme não encontrado')
  }
  const declarations = new Map([...theme.matchAll(DECLARATION)].map(([, name = '', value = '']) => [name, value.trim()]))

  return {
    light: resolveAll(declarations, 'light'),
    dark: resolveAll(declarations, 'dark'),
  }
}

/** Conteúdo entre as chaves do primeiro bloco que começa em `opener`, ou `undefined` se não houver. */
function blockAfter(source: string, opener: string): string | undefined {
  const start = source.indexOf(opener)
  const open = start === -1 ? -1 : source.indexOf('{', start)
  if (open === -1) {
    return undefined
  }
  const close = matchingClose(source, open, '{', '}')
  if (close === undefined) {
    throw new Error(`bloco ${opener} sem fechamento`)
  }
  return source.slice(open + 1, close)
}

function resolveAll(declarations: ReadonlyMap<string, string>, theme: Theme): Map<string, string> {
  return new Map([...declarations.keys()].map((name) => [name, resolve(name, declarations, theme)]))
}

function resolve(name: string, declarations: ReadonlyMap<string, string>, theme: Theme): string {
  const value = pickTheme(name, declarations.get(name) ?? '', theme)
  return value.replaceAll(VAR_REFERENCE, (_match, reference: string) => {
    if (!declarations.has(reference)) {
      throw new Error(`${name} aponta para ${reference}, que não existe`)
    }
    return resolve(reference, declarations, theme)
  })
}

/** Troca cada `light-dark(a, b)` do valor pelo argumento do tema pedido. */
function pickTheme(name: string, value: string, theme: Theme): string {
  const start = value.indexOf(LIGHT_DARK)
  if (start === -1) {
    return value
  }
  const open = start + LIGHT_DARK.length - 1
  const close = matchingClose(value, open, '(', ')')
  if (close === undefined) {
    throw new Error(`${name}: light-dark() sem fechamento`)
  }
  const [light, dark, ...extra] = splitTopLevel(value.slice(open + 1, close))
  if (light === undefined || dark === undefined || extra.length > 0) {
    throw new Error(`${name}: light-dark() precisa de dois argumentos`)
  }
  const chosen = theme === 'light' ? light : dark
  return value.slice(0, start) + chosen + pickTheme(name, value.slice(close + 1), theme)
}

/** Separa por vírgula sem quebrar o que está dentro de parênteses, como `oklch(0 0 0 / 0.2)`. */
function splitTopLevel(args: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of args) {
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
      continue
    }
    depth += char === '(' ? 1 : char === ')' ? -1 : 0
    current += char
  }
  parts.push(current.trim())
  return parts.filter((part) => part !== '')
}

/** Posição do fechamento que casa com a abertura em `open`, ou `undefined` se ele não existir. */
function matchingClose(source: string, open: number, opener: string, closer: string): number | undefined {
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === opener) {
      depth++
    } else if (source[index] === closer) {
      depth--
      if (depth === 0) {
        return index
      }
    }
  }
  return undefined
}
