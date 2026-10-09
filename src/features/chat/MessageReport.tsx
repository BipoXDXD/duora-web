import type { ChatMessage } from './chat.ts'
import { ReportForm } from './MessageReportForm.tsx'
import { ReportConfirmation } from './ReportConfirmation.tsx'
import { messageExcerpt } from './reportForm.ts'
import type { MessageReports } from './useMessageReports.ts'

interface ReportActionProps {
  readonly reports: MessageReports
  readonly message: ChatMessage
}

/**
 * O botão "Denunciar" de uma mensagem do par, ou a marca depois da denúncia. O contêiner fica o mesmo e a marca
 * é texto puro: a lista é `aria-relevant="additions"`, e trocar o botão pela marca não a anuncia de novo (quem
 * anuncia a denúncia é a confirmação).
 */
export function ReportAction({ reports, message }: ReportActionProps) {
  const isReported = reports.reportedSeqs.has(message.seq)
  return (
    <span className={isReported ? 'rounded-lg border border-edge px-3 py-1 text-sm font-semibold text-fg' : 'contents'}>
      {isReported ? (
        'Denunciada por você'
      ) : (
        <button
          ref={(button) => reports.registerButton(message.seq, button)}
          type="button"
          onClick={() => reports.start({ seq: message.seq, text: message.text })}
          aria-label={`Denunciar a mensagem “${messageExcerpt(message.text)}”`}
          className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          Denunciar
        </button>
      )}
    </span>
  )
}

interface ReportFlowProps {
  readonly eventId: string
  readonly roundNumber: number
  readonly reports: MessageReports
}

/** O formulário da denúncia aberta, ou a confirmação da última. Fica fora da lista, que é região viva. */
export function ReportFlow({ eventId, roundNumber, reports }: ReportFlowProps) {
  const { target, confirmation } = reports
  if (target !== null) {
    return <ReportForm key={target.seq} eventId={eventId} roundNumber={roundNumber} target={target} reports={reports} />
  }
  return confirmation === null ? null : <ReportConfirmation confirmation={confirmation} onBlockSettled={reports.updateBlock} />
}
