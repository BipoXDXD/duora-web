import type { Locator, Page } from '@playwright/test'

/** O evento para a equipe: estado, inscritos e publicar ou cancelar depois de confirmar. */
export class AdminEventPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async waitUntilReady(title: string): Promise<this> {
    await this.page.getByRole('heading', { level: 1, name: title }).waitFor()
    return this
  }

  readonly publishButton = (): Locator => this.page.getByRole('button', { name: 'Publicar evento' })
  readonly confirmPublishButton = (): Locator => this.page.getByRole('button', { name: 'Sim, publicar' })

  /** A etiqueta do estado do evento ("Rascunho", "Publicado"...). */
  phase(label: string): Locator {
    return this.page.getByText(label, { exact: true })
  }

  notice(text: string): Locator {
    return this.page.getByRole('status').filter({ hasText: text })
  }

  async publish(): Promise<void> {
    await this.publishButton().click()
    await this.confirmPublishButton().click()
  }
}
