/**
 * O relógio de quem precisa saber que horas são fora do render. Recebê-lo como parâmetro deixa o teste passar o
 * seu; o app usa `systemClock`.
 */
export type Clock = () => Date

export const systemClock: Clock = () => new Date()
