import { z } from 'zod/mini'
import { readJsonBody, sendApiRequest } from '../../shared/api/http.ts'
import { instantSchema, pageQuery } from '../events/events.ts'

/** Corpo de GET /api/me/connections (ConnectionsResponse): a outra conta e quando a conexão se formou. */
const connectionsPageSchema = z.object({
  items: z.array(z.object({ accountId: z.uuid(), connectedAt: instantSchema })),
  nextPageToken: z.nullable(z.string()),
})

/** O que o schema aceita da API; o teste compara com o tipo gerado da spec. */
export type ConnectionsPageWire = z.input<typeof connectionsPageSchema>

export type ConnectionsPage = Readonly<z.output<typeof connectionsPageSchema>>

export type Connection = Readonly<ConnectionsPage['items'][number]>

/** Uma página das próprias conexões, da mais recente para a mais antiga; o tamanho é o padrão da API. */
export async function fetchConnectionsPage(pageToken: string | null): Promise<ConnectionsPage> {
  const response = await sendApiRequest({ method: 'GET', path: `/api/me/connections${pageQuery(pageToken)}` })
  return readJsonBody(response, connectionsPageSchema)
}
