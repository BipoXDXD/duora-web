import type { ReactNode } from 'react'
import { SECONDARY_BUTTON } from './styles.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface FocusReturnButtonProps {
  /** Verdadeiro quando o botão volta depois de a pessoa cancelar o passo que ele abriu. */
  readonly hasFocus: boolean
  readonly onClick: () => void
  readonly className?: string
  readonly describedBy?: string
  readonly children: ReactNode
}

/**
 * O botão que abre um passo (confirmar, editar) e recebe o foco de volta quando a pessoa cancela: sem isso, o
 * foco cairia no `body` junto com o passo que sumiu.
 */
export function FocusReturnButton({
  hasFocus,
  onClick,
  className = SECONDARY_BUTTON,
  describedBy,
  children,
}: FocusReturnButtonProps) {
  const ref = useFocusOnMount<HTMLButtonElement>()
  return (
    <button
      ref={hasFocus ? ref : undefined}
      type="button"
      aria-describedby={describedBy}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  )
}
