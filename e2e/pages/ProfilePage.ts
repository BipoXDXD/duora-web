import type { Locator, Page } from '@playwright/test'

/** "Meu perfil": ver os dados, editar com a versão (ETag) da leitura e salvar. */
export class ProfilePage {
  private readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async open(): Promise<this> {
    await this.page.goto('/perfil')
    await this.editButton().waitFor()
    return this
  }

  readonly editButton = (): Locator => this.page.getByRole('button', { name: 'Editar perfil' })
  readonly form = (): Locator => this.page.getByRole('form', { name: 'Editar perfil' })
  readonly name = (): Locator => this.form().getByLabel('Nome')
  readonly region = (): Locator => this.form().getByLabel('Estado')
  readonly bio = (): Locator => this.form().getByLabel('Apresentação')
  readonly saveButton = (): Locator => this.form().getByRole('button', { name: 'Salvar' })

  /** O aviso do formulário inteiro (`alert`), como o de perfil desatualizado. */
  alert(text: string): Locator {
    return this.form().getByRole('alert').filter({ hasText: text })
  }

  savedNotice(): Locator {
    return this.page.getByRole('status').filter({ hasText: 'Perfil salvo.' })
  }

  /** O valor de um item da visão (`dl`), como "Nome" ou "Estado". */
  detail(term: string): Locator {
    return this.page.locator('dt', { hasText: term }).locator('xpath=following-sibling::dd[1]')
  }

  async startEditing(): Promise<void> {
    await this.editButton().click()
    await this.form().waitFor()
  }
}
