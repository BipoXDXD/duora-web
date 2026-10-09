import type { Locator, Page } from '@playwright/test'
import { DecisionSection } from './DecisionSection.ts'
import { RoundChat } from './RoundChat.ts'

/** "Sua dupla": quem é a dupla da rodada atual, a conversa com ela e a decisão privada depois da rodada. */
export class PairingSection {
  readonly chat: RoundChat
  readonly decision: DecisionSection
  private readonly section: Locator

  constructor(page: Page) {
    this.section = page.getByRole('region', { name: 'Sua dupla', exact: true })
    this.chat = new RoundChat(page)
    this.decision = new DecisionSection(page)
  }

  currentRound(round: number): Locator {
    return this.section.getByText(`Rodada atual: ${round}.`)
  }

  partner(round: number, code: string): Locator {
    return this.section.getByText(`Sua dupla na rodada ${round} é a conta ${code}.`)
  }
}
