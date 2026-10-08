import { SECONDARY_BUTTON } from './styles.ts'

interface LoadMoreProps {
  readonly hasNextPage: boolean
  readonly isFetchingNextPage: boolean
  /** A última tentativa de carregar a página seguinte falhou e nenhuma outra está em andamento. */
  readonly hasFailed: boolean
  readonly onLoadMore: () => void
}

/** "Carregar mais" de uma lista paginada por cursor, com o aviso quando a página seguinte falha. */
export function LoadMore({ hasNextPage, isFetchingNextPage, hasFailed, onLoadMore }: LoadMoreProps) {
  return (
    <>
      {hasFailed && (
        <p role="alert" className="font-semibold text-danger">
          Não foi possível carregar mais. Tente de novo.
        </p>
      )}
      {hasNextPage && (
        <button type="button" onClick={onLoadMore} disabled={isFetchingNextPage} className={SECONDARY_BUTTON}>
          {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </>
  )
}
