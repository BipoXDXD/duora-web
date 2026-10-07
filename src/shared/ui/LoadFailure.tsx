import { SECONDARY_BUTTON } from './styles.ts'

interface LoadFailureProps {
  readonly message: string
  readonly onRetry: () => void
}

/** Uma leitura que falhou: o que não carregou e como tentar de novo. */
export function LoadFailure({ message, onRetry }: LoadFailureProps) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p role="alert" className="text-fg">
        {message}
      </p>
      <button type="button" onClick={onRetry} className={SECONDARY_BUTTON}>
        Tentar de novo
      </button>
    </div>
  )
}
