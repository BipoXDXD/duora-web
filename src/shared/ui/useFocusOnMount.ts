import { useEffect, useRef, type RefObject } from 'react'

/**
 * Põe o foco no elemento quando ele aparece. Serve para o leitor de tela e o teclado acompanharem uma troca
 * de página ou de modo; o elemento que não é focável por natureza precisa de `tabIndex={-1}`.
 */
export function useFocusOnMount<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return ref
}
