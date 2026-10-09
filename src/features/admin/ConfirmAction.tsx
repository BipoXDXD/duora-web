import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'

interface ConfirmActionProps {
  readonly question: string
  readonly confirmLabel: string
  readonly pendingLabel: string
  readonly isPending: boolean
  readonly onConfirm: () => void
  readonly onBack: () => void
}

/**
 * O passo de confirmação de uma ação que não se desfaz: a pergunta, "confirmar" com o foco e "voltar". As duas
 * opções têm o mesmo peso de sempre (primário e secundário); o vermelho forte não tem token no tema ainda.
 */
export function ConfirmAction({ question, confirmLabel, pendingLabel, isPending, onConfirm, onBack }: ConfirmActionProps) {
  const confirmRef = useFocusOnMount<HTMLButtonElement>()
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-fg">{question}</p>
      <div className="flex flex-wrap gap-4">
        <button ref={confirmRef} type="button" onClick={onConfirm} disabled={isPending} className={PRIMARY_BUTTON}>
          {isPending ? pendingLabel : confirmLabel}
        </button>
        <button type="button" onClick={onBack} disabled={isPending} className={SECONDARY_BUTTON}>
          Voltar
        </button>
      </div>
    </div>
  )
}
