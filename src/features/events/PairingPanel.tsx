import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { READ_OPTIONS } from '../../shared/api/readOptions.ts'
import { RoundChatPanel } from '../chat/RoundChatPanel.tsx'
import { DecisionPanel } from '../connections/DecisionPanel.tsx'
import { LoadFailure } from '../../shared/ui/LoadFailure.tsx'
import { SECONDARY_BUTTON } from '../../shared/ui/styles.ts'
import { EVENT_KEYS } from './eventQueries.ts'
import { accountCode } from './eventText.ts'
import { fetchPairing, FIRST_ROUND, type Pairing } from './pairing.ts'
import { useRoundAnnouncement } from './useRoundAnnouncement.ts'

interface PairingPanelProps {
  readonly eventId: string
  /** A última rodada que o anfitrião iniciou, ou `null` se nenhuma começou (`EventResponse.currentRound`). */
  readonly currentRound: number | null
}

/**
 * "Sua dupla" para quem está inscrito num evento em andamento. A rodada vem do evento: a atual é a padrão, e
 * as anteriores (1 até a atual) ficam a um botão de distância. Rodada que ainda não começou não se pede. A
 * página relê o evento sozinha (`useEventRefresh`): quando o anfitrião inicia uma rodada, quem acompanha a atual
 * passa para ela, e uma região `role="status"` só para leitor de tela avisa.
 */
export function PairingPanel({ eventId, currentRound }: PairingPanelProps) {
  const headingId = useId()
  const announcement = useRoundAnnouncement(currentRound)
  return (
    <section aria-labelledby={headingId} className="flex flex-col items-start gap-4">
      <h2 id={headingId} className="font-display text-2xl font-medium text-fg">
        Sua dupla
      </h2>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {currentRound === null ? (
        <NoRoundYet eventId={eventId} />
      ) : (
        <Rounds eventId={eventId} currentRound={currentRound} />
      )}
    </section>
  )
}

function NoRoundYet({ eventId }: { readonly eventId: string }) {
  return (
    <>
      <p className="text-lg text-fg">Nenhuma rodada começou ainda.</p>
      <CheckForRounds eventId={eventId} label="Ver se a primeira rodada começou" />
    </>
  )
}

/**
 * Relê o evento na hora, que é onde a API diz qual rodada está valendo. A página já o relê sozinha a cada ~15 s;
 * o botão fica para não esperar esse intervalo (o anfitrião acabou de avisar) e para quem não depende de uma
 * atualização automática. Mostra "Verificando…" só na leitura que a pessoa pediu: a de segundo plano não pode
 * piscar nem desabilitar o botão com o foco nele.
 */
function CheckForRounds({ eventId, label }: { readonly eventId: string; readonly label: string }) {
  const queryClient = useQueryClient()
  const [isChecking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    try {
      await queryClient.invalidateQueries({ queryKey: EVENT_KEYS.event(eventId) })
    } finally {
      setChecking(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void check()}
      disabled={isChecking}
      className={SECONDARY_BUTTON}
    >
      {isChecking ? 'Verificando…' : label}
    </button>
  )
}

interface RoundsProps {
  readonly eventId: string
  readonly currentRound: number
}

/**
 * `chosen` é `null` enquanto a pessoa acompanha a rodada atual: quando o evento passa para a próxima, a tela
 * acompanha. Escolher uma anterior fixa a escolha; voltar à atual a solta de novo.
 */
function Rounds({ eventId, currentRound }: RoundsProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const round = chosen ?? currentRound
  const query = useQuery({
    queryKey: EVENT_KEYS.pairing(eventId, round),
    queryFn: () => fetchPairing(eventId, round),
    ...READ_OPTIONS,
  })

  function showRound(next: number) {
    setChosen(next === currentRound ? null : next)
  }

  return (
    <>
      <p className="text-fg-muted">
        {round === currentRound ? `Rodada atual: ${round}.` : `Rodada ${round}. A rodada atual é a ${currentRound}.`}
      </p>
      <div aria-live="polite" className="flex w-full flex-col items-start gap-4">
        <RoundResult
          eventId={eventId}
          round={round}
          pairing={query.data}
          isLoading={query.isFetching}
          hasFailed={query.isError}
          onRetry={() => void query.refetch()}
        />
      </div>
      {/*
        Fora da região viva acima: a conversa tem a sua, e o contador do campo não pode ser anunciado a cada tecla.
        Só na rodada atual, porque a de uma rodada anterior já não recebe mensagens.
      */}
      {round === currentRound && !query.isFetching && query.data?.kind === 'paired' && (
        <RoundChatPanel key={round} eventId={eventId} roundNumber={round} />
      )}
      {currentRound > FIRST_ROUND && (
        <div role="group" aria-label="Escolher a rodada" className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => showRound(round - 1)}
            disabled={round <= FIRST_ROUND}
            className={SECONDARY_BUTTON}
          >
            Rodada anterior
          </button>
          <button
            type="button"
            onClick={() => showRound(round + 1)}
            disabled={round >= currentRound}
            className={SECONDARY_BUTTON}
          >
            Rodada seguinte
          </button>
        </div>
      )}
      <CheckForRounds eventId={eventId} label="Ver se começou outra rodada" />
    </>
  )
}

interface RoundResultProps {
  readonly eventId: string
  readonly round: number
  readonly pairing: Pairing | undefined
  readonly isLoading: boolean
  readonly hasFailed: boolean
  readonly onRetry: () => void
}

function RoundResult({ eventId, round, pairing, isLoading, hasFailed, onRetry }: RoundResultProps) {
  if (isLoading) {
    return <p className="text-fg-muted">{`Procurando sua dupla na rodada ${round}…`}</p>
  }
  if (hasFailed || pairing === undefined) {
    return <LoadFailure message={`Não foi possível ver sua dupla na rodada ${round}.`} onRetry={onRetry} />
  }
  return (
    <>
      <p className="w-full rounded-lg bg-surface p-4 text-lg text-fg shadow-raised">{pairingText(round, pairing)}</p>
      {pairing.kind === 'paired' && <DecisionPanel key={round} eventId={eventId} roundNumber={round} />}
    </>
  )
}

function pairingText(round: number, pairing: Pairing): string {
  switch (pairing.kind) {
    case 'paired':
      return `Sua dupla na rodada ${round} é a conta ${accountCode(pairing.partnerAccountId)}.`
    case 'sittingOut':
      return `Na rodada ${round} você ficou de fora. Na próxima, quem ficou de fora tem prioridade.`
    case 'notInRound':
      return `Você não estava na rodada ${round}.`
  }
}
