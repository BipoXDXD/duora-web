/**
 * Põe o foco no primeiro campo com problema, na ordem de `fields` (a da tela), para o leitor de tela ler o
 * erro dele. Cada campo é achado pelo `name` no formulário.
 */
export function focusFirstProblem<F extends string>(
  form: HTMLFormElement | null,
  fields: readonly F[],
  problems: Readonly<Partial<Record<F, unknown>>>,
): void {
  const first = fields.find((field) => problems[field] !== undefined)
  const control = first === undefined ? null : form?.elements.namedItem(first)
  if (control instanceof HTMLElement) {
    control.focus()
  }
}
