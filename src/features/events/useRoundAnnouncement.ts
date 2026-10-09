import { useState } from 'react'

/**
 * O texto para a região `role="status"` quando uma rodada nova começa com a página aberta, ou `''` antes disso.
 * A rodada que já valia quando a tela abriu não é anunciada, nem a releitura que traz a mesma rodada: o texto só
 * muda, e só então o leitor de tela o lê, quando `currentRound` muda.
 */
export function useRoundAnnouncement(currentRound: number | null): string {
  const [seenRound, setSeenRound] = useState(currentRound)
  const [announcement, setAnnouncement] = useState('')
  if (currentRound !== seenRound) {
    // Ajuste durante o render, a partir do valor anterior (padrão da documentação do React): sem efeito, sem um
    // render a mais com o texto velho.
    setSeenRound(currentRound)
    if (currentRound !== null) {
      setAnnouncement(`A rodada ${currentRound} começou.`)
    }
  }
  return announcement
}
