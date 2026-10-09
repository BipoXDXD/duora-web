import { useEffect, useState } from 'react'
import { systemClock, type Clock } from '../../shared/browser/clock.ts'
import { eventPhaseAt, nextPhaseChange, type EventPhase, type SocialEvent } from './events.ts'

/** O maior atraso que o `setTimeout` aceita (inteiro de 32 bits); acima dele dispararia na hora. */
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1

/**
 * A fase do evento agora, sem perguntar à API: o hook marca um timer para o próximo limite (o início, depois o
 * fim) e recalcula quando ele chega. `readAt` é o instante da leitura do evento: reler o evento (depois de um 409,
 * por exemplo) também atualiza a fase, e vale o mais recente dos dois instantes.
 *
 * Só com a aba visível (Page Visibility): oculta, o timer para, e ao voltar a fase é recalculada pelo relógio.
 */
export function useEventPhase(event: SocialEvent, readAt: number, clock: Clock = systemClock): EventPhase {
  const [clockAt, setClockAt] = useState(() => clock().getTime())
  const now = new Date(Math.max(clockAt, readAt))
  const changeAt = nextPhaseChange(event, now)?.getTime() ?? null

  useEffect(() => {
    if (changeAt === null) {
      return undefined
    }
    const limit: number = changeAt
    let timer: ReturnType<typeof setTimeout> | undefined

    function arm() {
      timer = undefined
      if (document.visibilityState === 'hidden') {
        return
      }
      const current = clock().getTime()
      const remaining = limit - current
      if (remaining > 0) {
        timer = setTimeout(arm, Math.min(remaining, MAX_TIMER_DELAY_MS))
      } else {
        // O limite chegou (ou passou com a aba oculta): a fase muda, e o próximo limite entra no efeito seguinte.
        setClockAt(current)
      }
    }

    function onVisibilityChange() {
      clearTimeout(timer)
      arm()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    arm()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [changeAt, clock])

  return eventPhaseAt(event, now)
}
