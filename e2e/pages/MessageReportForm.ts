import type { Locator, Page } from '@playwright/test'

/** "Denunciar mensagem": motivo, descrição e o bloqueio opcional, e depois a confirmação. */
export class MessageReportForm {
  private readonly page: Page
  private readonly section: Locator

  constructor(page: Page) {
    this.page = page
    this.section = page.getByRole('region', { name: 'Denunciar mensagem' })
  }

  readonly heading = (): Locator => this.section.getByRole('heading', { name: 'Denunciar mensagem' })
  readonly alsoBlock = (): Locator => this.section.getByRole('checkbox', { name: 'Também bloquear esta pessoa' })
  readonly description = (): Locator => this.section.getByLabel('Descrição')
  readonly submitButton = (): Locator => this.section.getByRole('button', { name: /^Enviar denúncia/ })

  reason(label: string): Locator {
    return this.section.getByRole('radio', { name: label })
  }

  /** A confirmação (`status`) depois do 201; o resto da tela fica fora do formulário, que some. */
  confirmation(): Locator {
    return this.page.getByRole('status').filter({ hasText: 'Denúncia enviada.' })
  }

  /** O erro de um campo ou do formulário, pelo texto. */
  problem(text: string): Locator {
    return this.section.getByText(text)
  }

  failureAlert(text: string): Locator {
    return this.page.getByRole('alert').filter({ hasText: text })
  }
}
