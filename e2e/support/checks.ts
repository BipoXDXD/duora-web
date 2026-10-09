import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** As regras WCAG 2.0/2.1 A e AA: o piso de acessibilidade do projeto (docs do README, seção E2E). */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const

/** A página não rola para o lado: nada vaza da largura da tela (360 px é o caso difícil). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'px que a página excede a largura da janela').toBeLessThanOrEqual(0)
}

/** O estado atual da página não tem violação WCAG A/AA que o axe consiga detectar (nome, papel, contraste, rótulo). */
export async function expectNoAccessibilityViolations(page: Page, disabledRules: readonly string[] = []): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .disableRules([...disabledRules])
    .analyze()
  const summary = violations.map(
    (violation) => `${violation.id} (${violation.impact ?? '?'}): ${violation.help} -> ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`,
  )
  expect(summary, 'violações de acessibilidade').toEqual([])
}

/** Os dois checks de cada estado importante de uma jornada, em qualquer largura. */
export async function expectUsableLayout(page: Page, disabledRules: readonly string[] = []): Promise<void> {
  await expectNoHorizontalScroll(page)
  await expectNoAccessibilityViolations(page, disabledRules)
}
