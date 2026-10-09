/** "em instantes", "em 1 segundo" ou "em N segundos", pelo `Retry-After` da API. */
export function waitText(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null || retryAfterSeconds === 0) {
    return 'em instantes'
  }
  return retryAfterSeconds === 1 ? 'em 1 segundo' : `em ${retryAfterSeconds} segundos`
}
