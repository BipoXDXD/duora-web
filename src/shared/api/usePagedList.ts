import { useInfiniteQuery } from '@tanstack/react-query'
import { READ_OPTIONS } from './readOptions.ts'

interface Page<T> {
  readonly items: readonly T[]
  readonly nextPageToken: string | null
}

const FIRST_PAGE: string | null = null

/** Uma lista paginada por cursor, com as páginas já carregadas juntas em `items`. */
export function usePagedList<T>(
  queryKey: readonly string[],
  fetchPage: (pageToken: string | null) => Promise<Page<T>>,
) {
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
    error: query.error,
    retry: () => void query.refetch(),
    loadMore: {
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      hasFailed: query.isFetchNextPageError && !query.isFetchingNextPage,
      onLoadMore: () => void query.fetchNextPage(),
    },
  }
}
