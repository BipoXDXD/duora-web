import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { isBug } from '../../shared/api/http.ts'
import { READ_OPTIONS } from '../../shared/api/readOptions.ts'
import { AppLink } from '../../shared/routing/AppLink.tsx'
import { PATHS } from '../../shared/routing/routes.ts'
import { formatDay } from '../../shared/text/dateFormat.ts'
import { FocusReturnButton } from '../../shared/ui/FocusReturnButton.tsx'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { LOGIN_URL } from '../auth/loginUrl.ts'
import { EVENT_KEYS } from './eventQueries.ts'
import { noticeOfCancel, noticeOfRegister, type RegistrationNotice } from './registrationNotices.ts'
import { cancelRegistration, fetchRegistration, register, type Registration } from './registrations.ts'

interface RegistrationPanelProps {
  readonly eventId: string
}

/** Notícia mostrada; o número muda a cada resposta, para o mesmo aviso repetido ser anunciado de novo. */
interface ShownNotice {
  readonly notice: RegistrationNotice
  readonly id: number
}

/** Inscrição de um evento que ainda vai começar: inscrever-se ou cancelar, com cada falha explicada. */
export function RegistrationPanel({ eventId }: RegistrationPanelProps) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: EVENT_KEYS.registration(eventId),
    queryFn: () => fetchRegistration(eventId),
    ...READ_OPTIONS,
  })
  const [shown, setShown] = useState<ShownNotice | null>(null)
  const headingId = useId()

  /**
   * Guarda a inscrição nova no cache e relê o evento quando a API disse que ele mudou (lotou, foi cancelado,
   * começou ou sumiu), para a página mostrar o estado novo.
   */
  function apply(notice: RegistrationNotice, registration: Registration | null | undefined, eventChanged: boolean) {
    if (registration !== undefined) {
      queryClient.setQueryData(EVENT_KEYS.registration(eventId), registration)
      void queryClient.invalidateQueries({ queryKey: EVENT_KEYS.myRegistrations })
    }
    if (eventChanged) {
      void queryClient.invalidateQueries({ queryKey: EVENT_KEYS.event(eventId) })
    }
    setShown((previous) => ({ notice, id: (previous?.id ?? 0) + 1 }))
  }

  const registerMutation = useMutation({
    mutationFn: () => register(eventId),
    throwOnError: isBug,
    onSuccess: (result) =>
      apply(
        noticeOfRegister(result),
        result.kind === 'registered' ? result.registration : undefined,
        result.kind === 'unavailable' || result.kind === 'notFound',
      ),
  })
  const cancelMutation = useMutation({
    mutationFn: () => cancelRegistration(eventId),
    throwOnError: isBug,
    onSuccess: (result) =>
      apply(
        noticeOfCancel(result),
        result.kind === 'cancelled' ? null : undefined,
        result.kind === 'tooLate' || result.kind === 'notFound',
      ),
  })

  if (query.data === undefined) {
    return query.isError ? (
      <LoadFailure message="Não foi possível verificar sua inscrição." onRetry={() => void query.refetch()} />
    ) : (
      <p role="status" className="text-fg-muted">
        Verificando sua inscrição…
      </p>
    )
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col items-start gap-4">
      <h2 id={headingId} className="font-display text-2xl font-medium text-fg">
        Sua inscrição
      </h2>
      {shown !== null && <NoticeMessage key={shown.id} notice={shown.notice} />}
      {query.data === null ? (
        <>
          {/* Com um próximo passo no aviso (completar o perfil, entrar), ele é o botão primário da tela. */}
          <p className="text-fg">As inscrições estão abertas.</p>
          <button
            type="button"
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className={shown?.notice.action != null ? SECONDARY_BUTTON : PRIMARY_BUTTON}
          >
            {registerMutation.isPending ? 'Inscrevendo…' : 'Quero me inscrever'}
          </button>
        </>
      ) : (
        <Registered
          registration={query.data}
          isCancelling={cancelMutation.isPending}
          onCancel={() => cancelMutation.mutate()}
        />
      )}
    </section>
  )
}

/** Sucesso recebe o foco, porque o botão usado some; erro é alerta e o foco fica no botão para tentar de novo. */
function NoticeMessage({ notice }: { readonly notice: RegistrationNotice }) {
  const ref = useFocusOnMount<HTMLDivElement>()
  const isSuccess = notice.tone === 'success'
  return (
    <div
      ref={isSuccess ? ref : undefined}
      tabIndex={isSuccess ? -1 : undefined}
      role={isSuccess ? 'status' : 'alert'}
      className={
        isSuccess
          ? 'w-full rounded-lg bg-primary-subtle p-4 font-semibold text-on-primary-subtle'
          : 'flex flex-col items-start gap-3 font-semibold text-danger'
      }
    >
      <p>{notice.text}</p>
      {notice.action === 'completeProfile' && (
        <AppLink to={PATHS.profile} className={PRIMARY_BUTTON}>
          Completar meu perfil
        </AppLink>
      )}
      {notice.action === 'signIn' && (
        <a href={LOGIN_URL} className={PRIMARY_BUTTON}>
          Entrar de novo
        </a>
      )}
    </div>
  )
}

interface RegisteredProps {
  readonly registration: Registration
  readonly isCancelling: boolean
  readonly onCancel: () => void
}

/** Quem está inscrito pode cancelar, depois de confirmar: num evento lotado, a vaga pode não voltar. */
function Registered({ registration, isCancelling, onCancel }: RegisteredProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [wasKept, setWasKept] = useState(false)

  function keep() {
    setWasKept(true)
    setIsConfirming(false)
  }

  return (
    <>
      <p className="text-fg">{`Você está na lista desde ${formatDay(registration.registeredAt)}.`}</p>
      {isConfirming || isCancelling ? (
        <ConfirmCancel isCancelling={isCancelling} onConfirm={onCancel} onKeep={keep} />
      ) : (
        <FocusReturnButton hasFocus={wasKept} onClick={() => setIsConfirming(true)}>
          Cancelar inscrição
        </FocusReturnButton>
      )}
    </>
  )
}

interface ConfirmCancelProps {
  readonly isCancelling: boolean
  readonly onConfirm: () => void
  readonly onKeep: () => void
}

function ConfirmCancel({ isCancelling, onConfirm, onKeep }: ConfirmCancelProps) {
  const confirmRef = useFocusOnMount<HTMLButtonElement>()
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-fg">Cancelar sua inscrição? Se o evento lotar, pode não haver vaga para voltar.</p>
      <div className="flex flex-wrap gap-4">
        <button ref={confirmRef} type="button" onClick={onConfirm} disabled={isCancelling} className={PRIMARY_BUTTON}>
          {isCancelling ? 'Cancelando…' : 'Sim, cancelar'}
        </button>
        <button type="button" onClick={onKeep} disabled={isCancelling} className={SECONDARY_BUTTON}>
          Manter inscrição
        </button>
      </div>
    </div>
  )
}
