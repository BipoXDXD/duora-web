import type { Locator, Page } from '@playwright/test'

/** "Sua inscrição": inscrever-se num evento que ainda vai começar, ou cancelar a inscrição. */
export class RegistrationSection {
  private readonly section: Locator

  constructor(page: Page) {
    this.section = page.getByRole('region', { name: 'Sua inscrição' })
  }

  readonly registerButton = (): Locator => this.section.getByRole('button', { name: 'Quero me inscrever' })
  readonly cancelButton = (): Locator => this.section.getByRole('button', { name: 'Cancelar inscrição' })

  /** O aviso de sucesso (`status`), que recebe o foco quando aparece. */
  success(text: string): Locator {
    return this.section.getByRole('status').filter({ hasText: text })
  }

  /** O aviso de erro (`alert`) com o motivo da recusa. */
  failure(text: string): Locator {
    return this.section.getByRole('alert').filter({ hasText: text })
  }

  /** Quando a pessoa entrou na lista, como a tela diz depois da inscrição. */
  onTheList(): Locator {
    return this.section.getByText(/^Você está na lista desde /)
  }

  async register(): Promise<void> {
    await this.registerButton().click()
  }
}
