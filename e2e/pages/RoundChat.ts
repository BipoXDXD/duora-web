import type { Locator, Page } from '@playwright/test'
import { MessageReportForm } from './MessageReportForm.ts'

/** "Conversa com sua dupla": a lista de mensagens (uma região viva), o campo e o envio. */
export class RoundChat {
  readonly report: MessageReportForm
  private readonly section: Locator

  constructor(page: Page) {
    this.section = page.getByRole('region', { name: 'Conversa com sua dupla' })
    this.report = new MessageReportForm(page)
  }

  readonly log = (): Locator => this.section.getByRole('log', { name: 'Mensagens' })
  readonly field = (): Locator => this.section.getByLabel('Sua mensagem')
  readonly sendButton = (): Locator => this.section.getByRole('button', { name: 'Enviar', exact: true })

  /** O item da lista com este texto (do par ou próprio). */
  message(text: string): Locator {
    return this.log().getByRole('listitem').filter({ hasText: text })
  }

  /** O estado "Enviando…" da mensagem que a API ainda não confirmou. */
  sending(): Locator {
    return this.log().getByText('Enviando…')
  }

  /** O botão "Denunciar" da mensagem do par com este texto (até 40 caracteres, o que cabe no nome do botão). */
  reportButtonFor(text: string): Locator {
    return this.log().getByRole('button', { name: `Denunciar a mensagem “${text}”`, exact: true })
  }

  async write(text: string): Promise<void> {
    await this.field().fill(text)
  }

  async send(text: string): Promise<void> {
    await this.write(text)
    await this.sendButton().click()
  }
}
