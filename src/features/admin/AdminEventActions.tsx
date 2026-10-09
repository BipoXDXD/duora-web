import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { isBug } from '../../shared/api/http.ts'
import { FocusReturnButton } from '../../shared/ui/FocusReturnButton.tsx'
import { PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { EVENT_KEYS } from '../events/eventQueries.ts'
import { cancelEvent, canCancelAt, publishEvent, type AdminEvent, type EventActionResult } from './adminEvents.ts'
import { noticeOfChange, type AdminNotice, type EventChange } from './adminNotices.ts'
import { AdminNoticeMessage } from './AdminNoticeMessage.tsx'
import { ADMIN_KEYS } from './adminQueries.ts'
import { ConfirmAction } from './ConfirmAction.tsx'

interface AdminEventActionsProps {
  readonly event: AdminEvent
  /** O instante da leitura do evento, para saber se ele ainda pode ser cancelado. */
  readonly now: Date
}

/** Notícia mostrada; o número muda a cada resposta, para o mesmo aviso repetido receber o foco de novo. */
interface ShownNotice {
  readonly notice: AdminNotice
  readonly id: number
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
  const [confirming, setConfirming] = useState<EventChange | null>(null)
  /** O botão que abriu a confirmação recebe o foco de volta quando a pessoa desiste. */
  const [returnFocusTo, setReturnFocusTo] = useState<EventChange | null>(null)
  const [shown, setShown] = useState<ShownNotice | null>(null)

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
    setConfirming(null)
    setReturnFocusTo(null)
    setShown((previous) => ({ notice: noticeOfChange(change, result), id: (previous?.id ?? 0) + 1 }))
  }

  const canPublish = event.status === 'DRAFT'
  const canCancel = canCancelAt(event, now)
  return (
    <section aria-labelledby={headingId} className="flex flex-col items-start gap-4">
      <h2 id={headingId} className="font-display text-2xl font-medium text-fg">
        Publicação
      </h2>
      {shown !== null && <AdminNoticeMessage key={shown.id} notice={shown.notice} />}
      {confirming !== null ? (
        <ConfirmAction
          question={CONFIRMATION[confirming].question}
          confirmLabel={CONFIRMATION[confirming].confirm}
          pendingLabel={CONFIRMATION[confirming].pending}
          isPending={mutation.isPending}
          onConfirm={() => mutation.mutate({ change: confirming })}
          onBack={() => {
            setReturnFocusTo(confirming)
            setConfirming(null)
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-4">
          {canPublish && (
            <FocusReturnButton
              className={PRIMARY_BUTTON}
              hasFocus={returnFocusTo === 'publish'}
              onClick={() => setConfirming('publish')}
            >
              Publicar evento
            </FocusReturnButton>
          )}
          {canCancel && (
            <FocusReturnButton hasFocus={returnFocusTo === 'cancel'} onClick={() => setConfirming('cancel')}>
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
