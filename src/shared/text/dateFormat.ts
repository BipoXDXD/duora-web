/** Sem `timeZone`: o Intl usa o fuso de quem está com o app aberto. */
const DAY_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })
const TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "10 de outubro de 2026". */
export function formatDay(instant: Date): string {
  return DAY_FORMAT.format(instant)
}

/** "19:05". */
export function formatTime(instant: Date): string {
  return TIME_FORMAT.format(instant)
}
