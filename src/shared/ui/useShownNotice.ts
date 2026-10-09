import { useState } from 'react'

export type Shown<T> = T & { readonly id: number }

/**
 * O aviso da última ação de um painel. Cada `show` ganha um `id` novo, para usar como `key`: o mesmo texto
 * mostrado de novo vira outro elemento, que recebe o foco e é anunciado outra vez.
 */
export function useShownNotice<T extends object>() {
  const [shown, setShown] = useState<Shown<T> | null>(null)
  return {
    shown,
    show: (entry: T) => setShown((previous) => ({ ...entry, id: (previous?.id ?? 0) + 1 })),
    hide: () => setShown(null),
  }
}
