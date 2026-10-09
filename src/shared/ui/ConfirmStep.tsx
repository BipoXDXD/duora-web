import type { ReactNode } from 'react'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './styles.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface ConfirmStepProps {
  /** A pergunta, com o que muda se a pessoa confirmar. */
  readonly children: ReactNode
  readonly confirmLabel: string
  readonly pendingLabel: string
  readonly backLabel?: string
  readonly isPending: boolean
  /** Primário por padrão; secundário quando a tela já tem outro passo como ação principal. */
  readonly confirmClassName?: string
  readonly onConfirm: () => void
  readonly onBack: () => void
}

/**
 * O passo de confirmação de uma ação que não se desfaz: a pergunta, "confirmar" com o foco e "voltar". As duas
 * opções têm o mesmo peso de sempre (primário e secundário); o vermelho forte não tem token no tema ainda.
 */
export function ConfirmStep({
  children,
  confirmLabel,
  pendingLabel,
  backLabel = 'Voltar',
  isPending,
  confirmClassName = PRIMARY_BUTTON,
  onConfirm,
  onBack,
}: ConfirmStepProps) {
  const confirmRef = useFocusOnMount<HTMLButtonElement>()
  return (
    <div className="flex flex-col items-start gap-3">
      {children}
      <div className="flex flex-wrap gap-4">
        <button ref={confirmRef} type="button" onClick={onConfirm} disabled={isPending} className={confirmClassName}>
          {isPending ? pendingLabel : confirmLabel}
        </button>
        <button type="button" onClick={onBack} disabled={isPending} className={SECONDARY_BUTTON}>
          {backLabel}
        </button>
      </div>
    </div>
  )
}
