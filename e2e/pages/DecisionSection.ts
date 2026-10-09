import type { Locator, Page } from '@playwright/test'

/** "Continuar em contato?": a decisão privada e final da pessoa depois de uma rodada com dupla. */
export class DecisionSection {
  private readonly section: Locator

  constructor(page: Page) {
    this.section = page.getByRole('region', { name: 'Continuar em contato?' })
  }

  readonly wantButton = (): Locator => this.section.getByRole('button', { name: 'Quero continuar em contato' })
  readonly declineButton = (): Locator => this.section.getByRole('button', { name: 'Não quero' })
  readonly confirmButton = (): Locator => this.section.getByRole('button', { name: 'Confirmar minha decisão' })
  readonly backButton = (): Locator => this.section.getByRole('button', { name: 'Voltar' })

  /** O que a tela repete antes de confirmar, porque a decisão é final. */
  chosen(text: string): Locator {
    return this.section.getByText(`Você escolheu: ${text}.`)
  }

  /** O aviso depois de gravar ("Decisão registrada."). */
  notice(text: string): Locator {
    return this.section.getByRole('status').filter({ hasText: text })
  }

  /** A decisão já gravada, como aparece também depois de recarregar a página. */
  recorded(text: string): Locator {
    return this.section.getByText(text)
  }

  async decideToStayInTouch(): Promise<void> {
    await this.wantButton().click()
    await this.confirmButton().click()
  }
}
