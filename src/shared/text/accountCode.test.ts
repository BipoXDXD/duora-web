import { describe, expect, it } from 'vitest'
import { accountCode } from './accountCode.ts'

describe('accountCode', () => {
  it('is the end of the account id', () => {
    expect(accountCode('0199a1d2-1111-7aaa-8bbb-cccc1a2b3c4d')).toBe('1a2b3c4d')
  })
})
