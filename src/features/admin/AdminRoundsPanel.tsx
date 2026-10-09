import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState, type FormEvent } from 'react'
import { isBug } from '../../shared/api/http.ts'
import { READ_OPTIONS } from '../../shared/api/readOptions.ts'
import { FormField } from '../../shared/ui/FormField.tsx'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { FIELD_CONTROL, PRIMARY_BUTTON } from '../../shared/ui/styles.ts'
import { useFocusOnMount } from '../../shared/ui/useFocusOnMount.ts'
import { EVENT_KEYS } from '../events/eventQueries.ts'
import { fetchEvent } from '../events/events.ts'
import { FIRST_ROUND, LAST_ROUND } from '../events/pairing.ts'
import { fetchAdminRound, startRound, type AdminEvent, type AdminPhase, type AdminRound, type StartRoundResult } from './adminEvents.ts'
import { noticeOfRound, type AdminNotice } from './adminNotices.ts'
import { AdminNoticeMessage } from './AdminNoticeMessage.tsx'
import { ADMIN_KEYS } from './adminQueries.ts'
import { roundCountsText } from './adminText.ts'
import { ConfirmAction } from './ConfirmAction.tsx'

interface AdminRoundsPanelProps {
  readonly event: AdminEvent
  readonly phase: AdminPhase
}

/**
 * As rodadas. Só o evento publicado tem rodadas, e só em andamento se inicia uma; depois do início, a rodada
 * atual (que o evento público informa) mostra o resultado em contagens. Quem decide é sempre a API.
 */
export function AdminRoundsPanel({ event, phase }: AdminRoundsPanelProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col items-start gap-4">
      <h2 id={headingId} className="font-display text-2xl font-medium text-fg">
        Rodadas
      </h2>
      <RoundsBody event={event} phase={phase} />
    </section>
  )
}

function RoundsBody({ event, phase }: AdminRoundsPanelProps) {
  switch (phase) {
    case 'draft':
      return <p className="text-fg">As rodadas só começam com o evento publicado e em andamento.</p>
    case 'cancelled':
      return <p className="text-fg">Este evento foi cancelado, então não há rodadas a iniciar.</p>
    case 'upcoming':
      return <p className="text-fg">As rodadas começam depois do horário de início do evento.</p>
    case 'inProgress':
    case 'ended':
      return <StartedRounds event={event} canStart={phase === 'inProgress'} />
  }
}

/** A rodada atual vem do evento público (`currentRound`, a última iniciada); sem ela, o número é digitado. */
function StartedRounds({ event, canStart }: { readonly event: AdminEvent; readonly canStart: boolean }) {
  const query = useQuery({
    queryKey: EVENT_KEYS.event(event.id),
    queryFn: () => fetchEvent(event.id),
    ...READ_OPTIONS,
  })
  if (query.data === undefined) {
    return query.isError ? (
      <LoadFailure message="Não foi possível ver qual é a rodada atual." onRetry={() => void query.refetch()} />
    ) : (
      <p role="status" className="text-fg-muted">
        Vendo qual é a rodada atual…
      </p>
    )
  }
  const currentRound = query.data?.currentRound ?? null
  return (
    <>
      {currentRound === null ? <p className="text-fg">Nenhuma rodada começou ainda.</p> : <CurrentRound eventId={event.id} number={currentRound} />}
      {canStart ? (
        <RoundStarter event={event} currentRound={currentRound} />
      ) : (
        <p className="text-fg-muted">O evento terminou, então não dá mais para iniciar rodadas.</p>
      )}
    </>
  )
}

/** O resultado da rodada atual, só em contagens: a API nunca diz quem ficou com quem. */
function CurrentRound({ eventId, number }: { readonly eventId: string; readonly number: number }) {
  const query = useQuery({
    queryKey: ADMIN_KEYS.round(eventId, number),
    queryFn: () => fetchAdminRound(eventId, number),
    ...READ_OPTIONS,
  })
  if (query.data === undefined) {
    return query.isError ? (
      <LoadFailure message={`Não foi possível ver o resultado da rodada ${number}.`} onRetry={() => void query.refetch()} />
    ) : (
      <p role="status" className="text-fg-muted">
        {`Vendo o resultado da rodada ${number}…`}
      </p>
    )
  }
  return <RoundResult round={query.data} number={number} />
}

function RoundResult({ round, number }: { readonly round: AdminRound | null; readonly number: number }) {
  if (round === null) {
    return <p className="text-fg">{`Rodada atual: ${number}. O resultado ainda não está disponível.`}</p>
  }
  return (
    <div className="flex w-full flex-col gap-1 rounded-lg bg-surface p-4 shadow-raised">
      <p className="text-lg font-semibold text-fg">{`Rodada atual: ${round.number}`}</p>
      <p className="text-fg">{roundCountsText(round)}</p>
      <p className="text-sm text-fg-muted">{`Começou às ${TIME_FORMAT.format(round.startedAt)}.`}</p>
    </div>
  )
}

/** Sem `timeZone`: o Intl usa o fuso de quem está com o app aberto. */
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

interface ShownNotice {
  readonly notice: AdminNotice
  readonly id: number
}

const NUMBER_TEXT = /^\d+$/

/** O número que a pessoa digitou, se for uma rodada que a API aceita (1 a 100). */
function roundNumberOf(typed: string): number | null {
  const text = typed.trim()
  if (!NUMBER_TEXT.test(text)) {
    return null
  }
  const number = Number(text)
  return number >= FIRST_ROUND && number <= LAST_ROUND ? number : null
}

interface RoundStarterProps {
  readonly event: AdminEvent
  readonly currentRound: number | null
}

/**
 * Inicia uma rodada, depois de confirmar: o sorteio não se desfaz. O número começa na próxima (`currentRound`
 * + 1, ou 1) e pode ser trocado; repetir uma rodada que já existe devolve a mesma, sem novo sorteio.
 */
function RoundStarter({ event, currentRound }: RoundStarterProps) {
  const queryClient = useQueryClient()
  const suggested = currentRound === null ? String(FIRST_ROUND) : currentRound < LAST_ROUND ? String(currentRound + 1) : ''
  /** `null` enquanto a pessoa não digitou: o campo acompanha a rodada seguinte, que muda quando uma começa. */
  const [typed, setTyped] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [hasProblem, setHasProblem] = useState(false)
  /** Ao desistir da confirmação o foco volta para o campo do número. */
  const [returnedFromConfirm, setReturnedFromConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [shown, setShown] = useState<ShownNotice | null>(null)
  const value = typed ?? suggested

  const mutation = useMutation({
    mutationFn: ({ number }: { readonly number: number }) => startRound(event.id, number),
    throwOnError: isBug,
    onSuccess: (result, { number }) => {
      apply(number, result)
    },
  })

  function apply(number: number, result: StartRoundResult) {
    if (result.kind === 'started') {
      queryClient.setQueryData(ADMIN_KEYS.round(event.id, number), result.round)
      void queryClient.invalidateQueries({ queryKey: EVENT_KEYS.event(event.id) })
      setTyped(null)
    } else if (result.kind === 'notUnderway' || result.kind === 'refused' || result.kind === 'notFound') {
      void queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.event(event.id) })
    }
    setConfirming(null)
    setShown((previous) => ({ notice: noticeOfRound(number, result), id: (previous?.id ?? 0) + 1 }))
  }

  function ask(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault()
    setShown(null)
    const number = roundNumberOf(value)
    setHasProblem(number === null)
    setReturnedFromConfirm(false)
    setConfirming(number)
    if (number === null) {
      const control = formRef.current?.elements.namedItem('roundNumber')
      if (control instanceof HTMLElement) {
        control.focus()
      }
    }
  }

  if (currentRound === LAST_ROUND) {
    return <p className="text-fg">{`Todas as ${LAST_ROUND} rodadas já começaram.`}</p>
  }
  return (
    <>
      {shown !== null && <AdminNoticeMessage key={shown.id} notice={shown.notice} />}
      {confirming === null ? (
        <form ref={formRef} aria-label="Iniciar rodada" noValidate onSubmit={ask} className="flex w-full flex-col items-start gap-4">
          <FormField
            label="Número da rodada"
            hint={`De ${FIRST_ROUND} a ${LAST_ROUND}. Repetir uma rodada que já começou mostra a mesma, sem novo sorteio.`}
            problem={hasProblem ? `Informe um número de ${FIRST_ROUND} a ${LAST_ROUND}.` : null}
          >
            {(control) => (
              <RoundNumberInput
                control={control}
                takesFocus={returnedFromConfirm}
                value={value}
                onChange={setTyped}
              />
            )}
          </FormField>
          <button type="submit" className={PRIMARY_BUTTON}>
            Iniciar rodada
          </button>
        </form>
      ) : (
        <ConfirmAction
          question={confirmQuestion(confirming, event.registrationCount)}
          confirmLabel={`Sim, iniciar a rodada ${confirming}`}
          pendingLabel="Iniciando…"
          isPending={mutation.isPending}
          onConfirm={() => mutation.mutate({ number: confirming })}
          onBack={() => {
            setReturnedFromConfirm(true)
            setConfirming(null)
          }}
        />
      )}
    </>
  )
}

interface RoundNumberInputProps {
  readonly control: { readonly id: string; readonly 'aria-describedby': string; readonly 'aria-invalid': boolean }
  readonly takesFocus: boolean
  readonly value: string
  readonly onChange: (value: string) => void
}

function RoundNumberInput({ control, takesFocus, value, onChange }: RoundNumberInputProps) {
  const ref = useFocusOnMount<HTMLInputElement>()
  return (
    <input
      {...control}
      ref={takesFocus ? ref : undefined}
      name="roundNumber"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(changed) => onChange(changed.currentTarget.value)}
      className={FIELD_CONTROL}
    />
  )
}

function confirmQuestion(number: number, registrationCount: number): string {
  const people = registrationCount === 1 ? '1 pessoa inscrita' : `${registrationCount} pessoas inscritas`
  return `Iniciar a rodada ${number}? Os pares são sorteados agora entre as ${people} e o sorteio não se desfaz.`
}
