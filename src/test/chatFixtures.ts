/** Uma mensagem como a API a entrega (`sentAt` em texto), com a hora de envio fixa. */
export function message(seq: number, text: string, fromMe = false) {
  return { seq, fromMe, text, sentAt: '2026-10-10T23:05:00Z' }
}
