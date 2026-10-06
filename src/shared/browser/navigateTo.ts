/**
 * Navegação de página inteira, para fora do app (como o logout no Entra). Fica num módulo próprio
 * porque o jsdom não navega: os testes de componente trocam este módulo por um dublê.
 */
export function navigateTo(url: string): void {
  window.location.assign(url)
}
