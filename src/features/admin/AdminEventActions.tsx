import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId } from 'react'
import { isBug } from '../../shared/api/http.ts'
import { ConfirmStep } from '../../shared/ui/ConfirmStep.tsx'
import { FocusReturnButton } from '../../shared/ui/FocusReturnButton.tsx'
import { PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { useConfirmStep } from '../../shared/ui/useConfirmStep.ts'
import { useShownNotice } from '../../shared/ui/useShownNotice.ts'
import { EVENT_KEYS } from '../events/eventQueries.ts'
import { cancelEvent, canCancelAt, publishEvent, type AdminEvent, type EventActionResult } from './adminEvents.ts'
import { noticeOfChange, type AdminNotice, type EventChange } from './adminNotices.ts'
import { AdminNoticeMessage } from './AdminNoticeMessage.tsx'
import { ADMIN_KEYS } from './adminQueries.ts'

interface AdminEventActionsProps {
  readonly event: AdminEvent
  /** O instante da leitura do evento, para saber se ele ainda pode ser cancelado. */
  readonly now: Date
}

const CONFIRMATION: Readonly<Record<EventChange, { readonly question: string; readonly confirm: string; readonly pending: string }>> = {
  publish: {
    question: 'Publicar este evento? Ele passa a aparecer para quem entrou e a aceitar inscrições.',
    confirm: 'Sim, publicar',
    pending: 'Publicando…',
  },
  cancel: {
    question:
      'Cancelar este evento? Ele continua visível para quem se inscreveu, não aceita mais inscrições e isso não dá para desfazer.',
    confirm: 'Sim, cancelar o evento',
    pending: 'Cancelando…',
  },
}

/**
 * Publicar e cancelar, cada um depois de confirmar. Os botões seguem o que o front sabe do evento, mas quem
 * decide é a API: um 409 explica por quê e a página relê o evento.
 */
export function AdminEventActions({ event, now }: AdminEventActionsProps) {
  const queryClient = useQueryClient()
  const headingId = useId()
  /** O botão que abriu a confirmação recebe o foco de volta quando a pessoa desiste. */
  const confirmation = useConfirmStep<EventChange>()
  const { shown, show: showNotice } = useShownNotice<{ readonly notice: AdminNotice }>()

  const mutation = useMutation({
    mutationFn: ({ change }: { readonly change: EventChange }) =>
      change === 'publish' ? publishEvent(event.id) : cancelEvent(event.id),
    throwOnError: isBug,
    onSuccess: (result, { change }) => {
      apply(change, result)
    },
  })

  /** O evento novo vai direto para o cache; uma recusa ou sumiço manda reler, porque o estado mudou. */
  function apply(change: EventChange, result: EventActionResult) {
    if (result.kind === 'done') {
      queryClient.setQueryData(ADMIN_KEYS.event(event.id), { kind: 'found', event: result.event })
      void queryClient.invalidateQueries({ queryKey: EVENT_KEYS.list })
      void queryClient.invalidateQueries({ queryKey: EVENT_KEYS.event(event.id) })
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.lists })
    } else if (result.kind === 'refused' || result.kind === 'notFound') {
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.event(event.id) })
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.lists })
    }
    confirmation.close()
    showNotice({ notice: noticeOfChange(change, result) })
  }

  const { confirming } = confirmation
  const canPublish = event.status === 'DRAFT'
  const canCancel = canCancelAt(event, now)
  return (
    <section aria-labelledby={headingId} className="flex flex-col items-start gap-4">
      <h2 id={headingId} className="font-display text-2xl font-medium text-fg">
        Publicação
      </h2>
      {shown !== null && <AdminNoticeMessage key={shown.id} notice={shown.notice} />}
      {confirming !== null ? (
        <ConfirmStep
          confirmLabel={CONFIRMATION[confirming.subject].confirm}
          pendingLabel={CONFIRMATION[confirming.subject].pending}
          isPending={mutation.isPending}
          onConfirm={() => mutation.mutate({ change: confirming.subject })}
          onBack={confirmation.back}
        >
          <p className="text-fg">{CONFIRMATION[confirming.subject].question}</p>
        </ConfirmStep>
      ) : (
        <div className="flex flex-wrap gap-4">
          {canPublish && (
            <FocusReturnButton
              className={PRIMARY_BUTTON}
              hasFocus={confirmation.returnsFocusTo('publish')}
              onClick={() => confirmation.ask('publish')}
            >
              Publicar evento
            </FocusReturnButton>
          )}
          {canCancel && (
            <FocusReturnButton hasFocus={confirmation.returnsFocusTo('cancel')} onClick={() => confirmation.ask('cancel')}>
              Cancelar evento
            </FocusReturnButton>
          )}
          {!canPublish && !canCancel && <p className="text-fg-muted">{closedText(event)}</p>}
        </div>
      )}
    </section>
  )
}

function closedText(event: Pick<AdminEvent, 'status'>): string {
  return event.status === 'CANCELLED' ? 'Este evento foi cancelado.' : 'Este evento já terminou.'
}
