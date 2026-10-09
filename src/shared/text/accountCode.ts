/** A API não manda o nome da outra conta; o fim do id (aleatório no UUIDv7) distingue uma conta da outra. */
const ACCOUNT_CODE_LENGTH = 8

export function accountCode(accountId: string): string {
  return accountId.slice(-ACCOUNT_CODE_LENGTH)
}
