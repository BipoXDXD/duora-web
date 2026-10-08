import { useInfiniteQuery } from '@tanstack/react-query'
import { isBug } from '../../shared/api/http.ts'

/** Chaves do cache dos eventos; inscrever ou cancelar invalida as inscrições da pessoa. */
export const EVENT_KEYS = {
  list: ['events'] as const,
  event: (eventId: string) => ['event', eventId] as const,
  registration: (eventId: string) => ['registration', eventId] as const,
  myRegistrations: ['my-registrations'] as const,
  pairing: (eventId: string, roundNumber: number) => ['pairing', eventId, roundNumber] as const,
}

/** Sem retry automático: a tela mostra a falha na hora e oferece tentar de novo, como no resto do app. */
export const READ_OPTIONS = { retry: false, refetchOnWindowFocus: false, throwOnError: isBug } as const

interface Page<T> {
  readonly items: readonly T[]
  readonly nextPageToken: string | null
}

const FIRST_PAGE: string | null = null

/** Uma lista paginada por cursor, com as páginas já carregadas juntas em `items`. */
export function usePagedList<T>(queryKey: readonly string[], fetchPage: (pageToken: string | null) => Promise<Page<T>>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    ...READ_OPTIONS,
  })
  return {
    items: query.data?.pages.flatMap((page) => page.items),
    hasFailed: query.isError && query.data === undefined,
    retry: () => void query.refetch(),
    loadMore: {
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      hasFailed: query.isFetchNextPageError && !query.isFetchingNextPage,
      onLoadMore: () => void query.fetchNextPage(),
    },
  }
}
