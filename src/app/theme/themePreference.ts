/**
 * Tema escolhido à mão pelo visitante. Sem escolha, quem decide é o `color-scheme: dark light` do
 * `index.css`, que segue a preferência do sistema. A escolha vive no `localStorage`, que pode estar
 * bloqueado (aba privada, site data desligado): aí o tema troca na página, mas não é lembrado.
 */
export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'duora.theme'
export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)'

export function readStoredTheme(): ThemeChoice | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : null
  } catch {
    // Armazenamento bloqueado: é o mesmo que não ter escolha salva.
    return null
  }
}

export function storeTheme(theme: ThemeChoice): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Armazenamento bloqueado: a troca vale só para esta página, o que já é o comportamento esperado.
  }
}

/** O `index.css` lê `data-theme` na raiz para fixar o `color-scheme`. */
export function applyTheme(theme: ThemeChoice | null): void {
  if (theme === null) {
    delete document.documentElement.dataset.theme
    return
  }
  document.documentElement.dataset.theme = theme
}
