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

  it('paints only brand tones from index.css, converted to hex', () => {
    const { light } = readThemeTokens(css)
    const brandHex = ['600', '300', '50'].map((tone) => formatHex(light.get(`--color-brand-${tone}`) ?? 'invalid'))
    const fills = [...FAVICON.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(([, hex]) => hex)

    expect(fills).toEqual(brandHex)
  })
})
