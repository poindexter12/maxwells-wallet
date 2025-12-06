import { describe, it, expect } from 'vitest'
import { formatCurrency, formatAmount } from './format'

describe('formatCurrency', () => {
  it('formats positive amounts as USD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats negative amounts with minus sign', () => {
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('adds commas for thousands', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(123.456)).toBe('$123.46')
    expect(formatCurrency(123.454)).toBe('$123.45')
  })

  describe('with showSign=true', () => {
    it('shows plus sign for positive amounts', () => {
      expect(formatCurrency(100, true)).toBe('+$100.00')
    })

    it('shows minus sign for negative amounts', () => {
      expect(formatCurrency(-100, true)).toBe('-$100.00')
    })

    it('shows plus sign for zero', () => {
      expect(formatCurrency(0, true)).toBe('+$0.00')
    })
  })
})

describe('formatAmount', () => {
  it('formats positive amounts without dollar sign', () => {
    expect(formatAmount(1234.56)).toBe('1,234.56')
  })

  it('formats negative amounts with minus sign', () => {
    expect(formatAmount(-1234.56)).toBe('-1,234.56')
  })

  it('formats zero', () => {
    expect(formatAmount(0)).toBe('0.00')
  })

  it('adds commas for thousands', () => {
    expect(formatAmount(1000000)).toBe('1,000,000.00')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatAmount(123.456)).toBe('123.46')
    expect(formatAmount(123.454)).toBe('123.45')
  })
})
