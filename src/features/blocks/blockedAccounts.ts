import { z } from 'zod/mini'
import { readJsonBody, sendApiRequest } from '../../shared/api/http.ts'

/**
 * Corpo de GET /api/me/blocked-accounts (BlockedAccountsResponse da duora-api). O id é conferido como UUID
 * porque volta para a API no caminho do desbloqueio.
 */
const blockedPageSchema = z.object({
  items: z.array(z.object({ accountId: z.uuid(), blockedAt: z.iso.datetime({ offset: true }) })),
  nextPageToken: z.nullable(z.string()),
})

/** O que o schema aceita da API; o teste compara com o tipo gerado da spec. */
export type BlockedPageWire = z.input<typeof blockedPageSchema>

export type BlockedPage = Readonly<z.output<typeof blockedPageSchema>>

export type BlockedAccount = Readonly<BlockedPage['items'][number]>

const BLOCKED_ACCOUNTS_PATH = '/api/me/blocked-accounts'

/** Uma página, do bloqueio mais recente para o mais antigo. `null` pede a primeira; o tamanho é o padrão da API. */
export async function fetchBlockedPage(pageToken: string | null): Promise<BlockedPage> {
  const query = pageToken === null ? '' : `?${new URLSearchParams({ pageToken }).toString()}`
  const response = await sendApiRequest({ method: 'GET', path: `${BLOCKED_ACCOUNTS_PATH}${query}` })
  return readJsonBody(response, blockedPageSchema)
}

/** Desfaz o próprio bloqueio. A API é idempotente: sem bloqueio, também dá certo. */
export async function unblockAccount(accountId: string): Promise<void> {
  await sendApiRequest({ method: 'POST', path: `/api/accounts/${encodeURIComponent(accountId)}:unblock` })
}
