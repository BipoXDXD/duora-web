import type { Locator, Page } from '@playwright/test'
import { AdminNewEventPage } from './AdminNewEventPage.ts'

/** "Eventos da equipe": todos os eventos, rascunhos incluídos, com o caminho para criar um novo. */
export class AdminEventsPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Abre a lista e espera pelos eventos (quem tem o papel). */
  async open(): Promise<this> {
    await this.page.goto('/admin/eventos')
    await this.newEventLink().waitFor()
    return this
  }

  /** Abre a lista como quem não tem o papel: a API responde 403, e a tela só traz o aviso. */
  async openWithoutRole(): Promise<this> {
    await this.page.goto('/admin/eventos')
    await this.staffOnly().waitFor()
    return this
  }

  readonly newEventLink = (): Locator => this.page.getByRole('link', { name: 'Novo evento' })
  readonly events = (): Locator => this.page.getByRole('list', { name: 'Eventos' })

  /** O aviso para quem não tem o papel (403 da API). */
  staffOnly(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'Área só para a equipe.' })
  }

  eventLink(title: string): Locator {
    return this.events().getByRole('link', { name: title })
  }

  async startNewEvent(): Promise<AdminNewEventPage> {
    await this.newEventLink().click()
    return new AdminNewEventPage(this.page).waitUntilReady()
  }
}
