import { expect } from 'vitest'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../shared/ui/styles.ts'

/**
 * A pirâmide de botões é comportamento: o primário é a ação principal da tela, o secundário a que espera. O jsdom
 * não calcula estilo, então a checagem lê as classes inteiras, e não só uma delas.
 */
export function expectPrimaryAction(element: Element): void {
  expect(element.className).toBe(PRIMARY_BUTTON)
}

export function expectSecondaryAction(element: Element): void {
  expect(element.className).toBe(SECONDARY_BUTTON)
}
