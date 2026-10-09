import { useState } from 'react'

type ConfirmStepState<T> =
  | { readonly kind: 'idle'; readonly focusOn: T | null }
  | { readonly kind: 'confirming'; readonly subject: T }

/**
 * Os dois momentos de uma ação que pede confirmação: o botão (ou botões) que a abre e o passo de confirmação.
 * `subject` diz o que está sendo confirmado (qual botão abriu o passo, qual número); ao desistir com `back`, o
 * foco volta para o controle desse mesmo `subject`, em vez de cair no `body` junto com o passo que sumiu.
 */
export function useConfirmStep<T>() {
  const [step, setStep] = useState<ConfirmStepState<T>>({ kind: 'idle', focusOn: null })
  const focusReturnedTo = step.kind === 'idle' ? step.focusOn : null
  return {
    /** O que está sendo confirmado, ou `null` enquanto o passo está fechado. */
    confirming: step.kind === 'confirming' ? { subject: step.subject } : null,
    /** O controle de `subject` abre o passo de confirmação. */
    ask: (subject: T) => setStep({ kind: 'confirming', subject }),
    /** A pessoa desistiu: o passo fecha e o foco volta para quem o abriu. */
    back: () => setStep((previous) => (previous.kind === 'confirming' ? { kind: 'idle', focusOn: previous.subject } : previous)),
    /** A ação terminou, com sucesso ou não: o passo fecha e ninguém reclama o foco. */
    close: () => setStep({ kind: 'idle', focusOn: null }),
    /** Verdadeiro quando a pessoa desistiu da confirmação aberta por `subject`. */
    returnsFocusTo: (subject: T) => focusReturnedTo !== null && focusReturnedTo === subject,
    /** Verdadeiro quando a pessoa desistiu de uma confirmação, qualquer que fosse o `subject`. */
    returnsFocus: focusReturnedTo !== null,
  }
}
