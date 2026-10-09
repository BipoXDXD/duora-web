import type { Locator, Page } from '@playwright/test'
import { EVENT_ID } from '../support/data.ts'
import { PairingSection } from './PairingSection.ts'
import { RegistrationSection } from './RegistrationSection.ts'

/** A página de um evento (`/eventos/{id}`): o resumo, a inscrição e, durante o evento, a dupla da rodada. */
export class EventPage {
  readonly registration: RegistrationSection
  readonly pairing: PairingSection

  private readonly page: Page

  constructor(page: Page) {
    this.page = page
    this.registration = new RegistrationSection(page)
    this.pairing = new PairingSection(page)
  }

  /** Abre o evento e espera o título dele, que só aparece depois da leitura. */
  async open(title: string, eventId: string = EVENT_ID): Promise<this> {
    await this.page.goto(`/eventos/${eventId}`)
    await this.heading(title).waitFor()
    return this
  }

  /** Recarrega a página, como quem aperta F5, e espera o título de novo. */
  async reload(title: string): Promise<this> {
    await this.page.reload()
    await this.heading(title).waitFor()
    return this
  }

  heading(title: string): Locator {
    return this.page.getByRole('heading', { level: 1, name: title })
  }

  /** A etiqueta da fase ("Em andamento"), que não depende só da cor. */
  phase(label: string): Locator {
    return this.page.getByText(label, { exact: true })
  }
}
