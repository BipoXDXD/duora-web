// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import viteConfig from '../vite.config.ts'

const rawConfig = readFileSync(new URL('../public/staticwebapp.config.json', import.meta.url), 'utf8')

const BUILD_TIMEOUT_MS = 60_000
const CONFIG_FILE = 'staticwebapp.config.json'

interface StaticWebAppConfig {
  navigationFallback: { rewrite: string; exclude: string[] }
  routes?: Record<string, unknown>[]
  globalHeaders: Record<string, string>
}

const config = JSON.parse(rawConfig) as StaticWebAppConfig

/** Padrão do SWA (`*` e `{a,b}`) como regex, o bastante para os padrões deste arquivo. */
function matchesPattern(pattern: string, path: string): boolean {
  const source = pattern
    .replace(/[.+?^$()|[\]\\]/g, '\\$&')
    .replace(/\{([^}]*)\}/g, (_, options: string) => `(${options.split(',').join('|')})`)
    .replace(/\*/g, '.*')
  return new RegExp(`^${source}$`).test(path)
}

function isExcludedFromFallback(path: string): boolean {
  return config.navigationFallback.exclude.some((pattern) => matchesPattern(pattern, path))
}

type ContentSecurityPolicy = Record<string, string[]>

function parsePolicy(header: string): ContentSecurityPolicy {
  const entries = header
    .split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .filter(([name]) => name !== undefined && name !== '')
    .map(([name, ...sources]) => [name, sources] as const)
  return Object.fromEntries(entries)
}

const policy = parsePolicy(config.globalHeaders['content-security-policy'] ?? '')

/** Uma URL do build é local (`/assets/...`) ou `data:`; qualquer outra origem exigiria um host na política. */
function policyAllows(directive: string, url: string): boolean {
  const sources = policy[directive] ?? policy['default-src'] ?? []
  if (url.startsWith('data:')) {
    return sources.includes('data:')
  }
  return url.startsWith('/') && !url.startsWith('//') && sources.includes("'self'")
}

function tagsOf(html: string, tag: string): string[] {
  return html.match(new RegExp(`<${tag}\\b[^>]*>`, 'g')) ?? []
}

function attributeOf(tag: string, name: string): string | undefined {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1]
}

function urlsOf(css: string): string[] {
  return [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')
}

/** URLs que a política não permite na diretiva dada. */
function blockedBy(directive: string, urls: readonly string[]): string[] {
  return urls.filter((url) => !policyAllows(directive, url)).map((url) => `${directive}: ${url.slice(0, 60)}`)
}

describe('staticwebapp.config.json: fallback de navegação', () => {
  it('devolve o index.html para as páginas do app', () => {
    expect(config.navigationFallback.rewrite).toBe('/index.html')
  })

  it.each(['/', '/perfil', '/perfil/bloqueios', '/eventos', '/qualquer-coisa'])('deixa %s cair no fallback', (path) => {
    expect(isExcludedFromFallback(path)).toBe(false)
  })

  it.each([
    '/api/me',
    '/oauth2/authorization/entra',
    '/login/oauth2/code/entra',
    '/logout',
    '/assets/index-abc123.js',
    '/assets/index-abc123.css',
    '/assets/fraunces-latin-opsz-normal-abc.woff2',
    '/images/step1-match.webp',
    '/backgrounds/hero.webp',
    '/favicon.svg',
    '/apple-touch-icon.png',
  ])('não devolve o index.html para %s', (path) => {
    expect(isExcludedFromFallback(path)).toBe(true)
  })

  it('exclui todo caminho que o Vite repassa à API em desenvolvimento', () => {
    const proxiedPaths = Object.keys(viteConfig.server?.proxy ?? {})

    const reachedByFallback = proxiedPaths.filter((path) => !isExcludedFromFallback(path) && !isExcludedFromFallback(`${path}/probe`))

    expect(proxiedPaths.length).toBeGreaterThan(0)
    expect(reachedByFallback).toEqual([])
  })

  it('não define rotas com papéis, redirect nem rewrite: a autenticação é do BFF', () => {
    for (const route of config.routes ?? []) {
      expect(Object.keys(route).toSorted()).toEqual(['headers', 'route'])
    }
  })
})

describe('staticwebapp.config.json: headers', () => {
  const headers = config.globalHeaders

  it.each([
    ['x-content-type-options', 'nosniff'],
    ['x-frame-options', 'DENY'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['cross-origin-opener-policy', 'same-origin'],
  ])('define %s como %s', (name, value) => {
    expect(headers[name]).toBe(value)
  })

  it.each(['permissions-policy', 'strict-transport-security'])('define %s', (name) => {
    expect(headers[name]).toBeTruthy()
  })

  it('nega câmera, microfone e localização por padrão', () => {
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['permissions-policy']).toContain('microphone=()')
    expect(headers['permissions-policy']).toContain('geolocation=()')
  })

  it('serve o index.html e as páginas do fallback sempre revalidados', () => {
    expect(headers['cache-control']).toBe('no-cache')
  })

  it('guarda /assets/* (nome com hash) como imutável por um ano', () => {
    const assetsRoute = config.routes?.find((route) => route['route'] === '/assets/*')

    expect(assetsRoute?.['headers']).toEqual({ 'cache-control': 'public, max-age=31536000, immutable' })
  })

  describe('Content-Security-Policy', () => {
    it('só aceita script e estilo da própria origem, sem inline nem eval', () => {
      expect(policy['script-src']).toEqual(["'self'"])
      expect(policy['style-src']).toEqual(["'self'"])
      expect(config.globalHeaders['content-security-policy']).not.toMatch(/unsafe-inline|unsafe-eval/)
    })

    it('proíbe embutir o site, plugins e mudar o base URI', () => {
      expect(policy['frame-ancestors']).toEqual(["'none'"])
      expect(policy['object-src']).toEqual(["'none'"])
      expect(policy['base-uri']).toEqual(["'self'"])
    })

    it('fala só com a própria origem, porque a API é servida no mesmo site (ADR 0002 da duora-api)', () => {
      expect(policy['connect-src']).toEqual(["'self'"])
      expect(policy['form-action']).toEqual(["'self'"])
    })
  })
})

describe('CSP frente ao build gerado', () => {
  let outDir = ''

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), 'duora-web-dist-'))
    await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true } })
  }, BUILD_TIMEOUT_MS)

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true })
  })

  const readBuilt = (path: string) => readFileSync(join(outDir, path), 'utf8')

  it('copia o arquivo de configuração para a raiz do build, onde o SWA o lê', () => {
    expect(existsSync(join(outDir, CONFIG_FILE))).toBe(true)
    expect(readBuilt(CONFIG_FILE)).toBe(rawConfig)
  })

  it('gera um index.html sem script, estilo nem handler inline', () => {
    const html = readBuilt('index.html')

    expect(tagsOf(html, 'script').filter((tag) => attributeOf(tag, 'src') === undefined)).toEqual([])
    expect(html).not.toMatch(/<style\b/)
    expect(html).not.toMatch(/\sstyle="/)
    expect(html).not.toMatch(/\son[a-z]+="/)
  })

  it('referencia scripts, estilos e ícones que a política permite e que existem no build', () => {
    const html = readBuilt('index.html')
    const scripts = tagsOf(html, 'script').map((tag) => attributeOf(tag, 'src') ?? '')
    const links = tagsOf(html, 'link')
    const stylesheets = links.filter((tag) => attributeOf(tag, 'rel') === 'stylesheet').map((tag) => attributeOf(tag, 'href') ?? '')
    const icons = links.filter((tag) => /icon/.test(attributeOf(tag, 'rel') ?? '')).map((tag) => attributeOf(tag, 'href') ?? '')

    expect(scripts.length).toBeGreaterThan(0)
    expect(stylesheets.length).toBeGreaterThan(0)
    const blocked = [...blockedBy('script-src', scripts), ...blockedBy('style-src', stylesheets), ...blockedBy('img-src', icons)]
    const missing = [...scripts, ...stylesheets, ...icons].filter((url) => !existsSync(join(outDir, url)))

    expect(blocked).toEqual([])
    expect(missing).toEqual([])
  })

  it('só usa no CSS fontes e imagens da própria origem ou data:, como a política permite', () => {
    const html = readBuilt('index.html')
    const stylesheet = tagsOf(html, 'link')
      .filter((tag) => attributeOf(tag, 'rel') === 'stylesheet')
      .map((tag) => attributeOf(tag, 'href') ?? '')[0]
    const css = readBuilt(stylesheet ?? '')
    const fontFaces = css.match(/@font-face\s*\{[^}]*\}/g) ?? []
    const cssWithoutFonts = fontFaces.reduce((rest, block) => rest.replace(block, ''), css)
    const fonts = fontFaces.flatMap(urlsOf)
    const images = urlsOf(cssWithoutFonts)

    expect(fonts.length).toBeGreaterThan(0)
    expect([...blockedBy('font-src', fonts), ...blockedBy('img-src', images)]).toEqual([])
  })
})
