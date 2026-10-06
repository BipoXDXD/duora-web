import { formatHex } from 'culori'
import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import css from '../index.css?raw'
import { readThemeTokens } from '../test/themeTokens.ts'

const PUBLIC_SVGS = import.meta.glob<string>('../../public/*.svg', { query: '?raw', import: 'default', eager: true })
const FAVICON = PUBLIC_SVGS['../../public/favicon.svg'] ?? ''

describe('favicon', () => {
  it('is declared in index.html as an SVG icon', () => {
    expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
  })

  it('exists in public/, so the browser does not get a 404', () => {
    expect(FAVICON).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  })

  it('paints the lens from the logo with tones from index.css, converted to hex', () => {
    const { light } = readThemeTokens(css)
    const toneHex = ['plum-950', 'apricot-400', 'rose-300'].map((tone) => formatHex(light.get(`--color-${tone}`) ?? 'invalid'))
    const paints = [...FAVICON.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)].map(([, hex]) => hex)

    expect(paints).toEqual(toneHex)
  })
})
