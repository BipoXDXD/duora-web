import { describe, expect, it } from 'vitest'
import { formatDay, formatTime } from './dateFormat.ts'

describe('formatDay', () => {
  it('shows the day in full, in the time zone of the user', () => {
    expect(formatDay(new Date('2026-10-11T01:00:00Z'))).toBe('10 de outubro de 2026')
  })
})

describe('formatTime', () => {
  it('shows hours and minutes, in the time zone of the user', () => {
    expect(formatTime(new Date('2026-10-10T22:05:00Z'))).toBe('19:05')
  })
})
