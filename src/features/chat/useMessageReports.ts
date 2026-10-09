import { useCallback, useRef, useState } from 'react'

/** A mensagem do par que está sendo denunciada. */
export interface ReportTarget {
  readonly seq: number
  readonly text: string
}

/** O que aconteceu com o bloqueio pedido junto com a denúncia. A denúncia já está feita em todos os casos. */
export type BlockOutcome = 'notRequested' | 'blocked' | 'failed' | 'signedOut'

export interface Confirmation {
  readonly reportedAccountId: string
  readonly block: BlockOutcome
}

/**
 * As denúncias de mensagens do chat aberto nesta tela. A marca "Denunciada por você" vive só aqui, nesta
 * sessão: a API não diz quais mensagens a pessoa já denunciou, e a tela não inventa esse estado.
 */
export interface MessageReports {
  readonly reportedSeqs: ReadonlySet<number>
  readonly target: ReportTarget | null
  readonly confirmation: Confirmation | null
  readonly start: (target: ReportTarget) => void
  readonly cancel: () => void
  readonly finish: (seq: number, confirmation: Confirmation) => void
  readonly updateBlock: (block: BlockOutcome) => void
  /** Guarda o botão "Denunciar" de cada mensagem, para o foco voltar a ele quando o formulário fecha. */
  readonly registerButton: (seq: number, button: HTMLButtonElement | null) => void
}

export function useMessageReports(): MessageReports {
  const [reportedSeqs, setReportedSeqs] = useState<ReadonlySet<number>>(() => new Set())
  const [target, setTarget] = useState<ReportTarget | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const buttonsRef = useRef(new Map<number, HTMLButtonElement>())

  const start = useCallback((next: ReportTarget) => {
    setConfirmation(null)
    setTarget(next)
  }, [])

  const cancel = useCallback(() => {
    if (target !== null) {
      buttonsRef.current.get(target.seq)?.focus()
    }
    setTarget(null)
  }, [target])

  const finish = useCallback((seq: number, done: Confirmation) => {
    setReportedSeqs((current) => new Set(current).add(seq))
    setTarget(null)
    setConfirmation(done)
  }, [])

  const updateBlock = useCallback((block: BlockOutcome) => {
    setConfirmation((current) => (current === null ? null : { ...current, block }))
  }, [])

  const registerButton = useCallback((seq: number, button: HTMLButtonElement | null) => {
    if (button === null) {
      buttonsRef.current.delete(seq)
    } else {
      buttonsRef.current.set(seq, button)
    }
  }, [])

  return { reportedSeqs, target, confirmation, start, cancel, finish, updateBlock, registerButton }
}
