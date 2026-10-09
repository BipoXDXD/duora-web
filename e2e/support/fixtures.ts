import { expect, test as base } from '@playwright/test'
import { CSRF_COOKIE, CSRF_TOKEN, FakeApi } from './fakeApi.ts'

interface Fixtures {
  /** A duora-api simulada desta página; a rota que o teste não declara falha o teste. */
  readonly api: FakeApi
}

/**
 * `test` do Playwright com a API simulada já instalada na página e o cookie de CSRF que o Spring deixaria.
 * Ao fim de cada teste, confere que nenhuma rota ficou sem resposta, que toda mutação levou o token CSRF e que
 * a página não lançou erro (um bug de tela que o teste não olhou).
 */
export const test = base.extend<Fixtures>({
  api: async ({ page, context, baseURL }, run) => {
    if (baseURL === undefined) {
      throw new Error('O playwright.config.ts precisa definir o baseURL.')
    }
    await context.addCookies([{ name: CSRF_COOKIE, value: CSRF_TOKEN, url: baseURL }])
    const api = new FakeApi()
    await api.install(page)
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await run(api)

    expect(api.problems, 'pedidos à API que a jornada não previu').toEqual([])
    expect(pageErrors, 'erros não tratados na página').toEqual([])
  },
})

export { expect }
