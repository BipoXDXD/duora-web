import type { Locator, Page } from '@playwright/test'
import { AdminEventPage } from './AdminEventPage.ts'

export interface NewEventValues {
  readonly title: string
  readonly description: string
  /** `AAAA-MM-DDThh:mm`, como o `datetime-local` aceita. */
  readonly startsAt: string
  readonly endsAt: string
  readonly capacity: string
}

/** "Novo evento": o formulário do rascunho. */
export class AdminNewEventPage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  readonly form = (): Locator => this.page.getByRole('form', { name: 'Novo evento' })
  readonly submitButton = (): Locator => this.form().getByRole('button', { name: 'Criar rascunho' })

  async waitUntilReady(): Promise<this> {
    await this.form().waitFor()
    return this
  }

  problem(text: string): Locator {
    return this.form().getByText(text)
  }

  async fill(values: NewEventValues): Promise<void> {
    await this.form().getByLabel('Título').fill(values.title)
    await this.form().getByLabel('Descrição').fill(values.description)
    await this.form().getByLabel('Início').fill(values.startsAt)
    await this.form().getByLabel('Fim').fill(values.endsAt)
    await this.form().getByLabel('Capacidade').fill(values.capacity)
  }

  /** Cria o rascunho; a tela seguinte é a do evento. */
  async create(values: NewEventValues): Promise<AdminEventPage> {
    await this.fill(values)
    await this.submitButton().click()
    return new AdminEventPage(this.page).waitUntilReady(values.title)
  }
}
