import { useId, type ReactNode } from 'react'

/** O que um controle precisa para ficar ligado ao rótulo, à dica e ao erro do campo. */
interface ControlProps {
  readonly id: string
  readonly 'aria-describedby': string
  readonly 'aria-invalid': boolean
}

interface FormFieldProps {
  readonly label: string
  readonly hint: string
  readonly problem: string | null
  readonly children: (control: ControlProps) => ReactNode
}

/** Rótulo, controle, dica e erro, com o erro lido pelo leitor de tela junto com o campo. */
export function FormField({ label, hint, problem, children }: FormFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const problemId = `${id}-problem`
  const describedBy = problem === null ? hintId : `${problemId} ${hintId}`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold text-fg">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': problem !== null })}
      {problem !== null && (
        <p id={problemId} className="text-sm font-semibold text-danger">
          {problem}
        </p>
      )}
      <p id={hintId} className="text-sm text-fg-muted">
        {hint}
      </p>
    </div>
  )
}
