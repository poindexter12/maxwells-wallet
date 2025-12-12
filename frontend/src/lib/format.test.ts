import { describe, it, expect } from 'vitest'
import { formatCurrency, formatAmount, formatCompactCurrency } from './format'

describe('formatCurrency', () => {
  it('formats positive amounts as USD by default', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats with locale-specific currency', () => {
    // EUR locales
    expect(formatCurrency(1234.56, false, 'de-DE')).toMatch(/1\.234,56\s*€/)
    expect(formatCurrency(1234.56, false, 'fr-FR')).toMatch(/1\s?234,56\s*€/)

    // GBP for UK
    expect(formatCurrency(1234.56, false, 'en-GB')).toBe('£1,234.56')

    // USD for en-US
    expect(formatCurrency(1234.56, false, 'en-US')).toBe('$1,234.56')
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

describe('formatCompactCurrency', () => {
  it('formats compact amounts as USD by default', () => {
    // Node versions differ: some output "$1K", others "$1.0K"
    expect(formatCompactCurrency(1000)).toMatch(/^\$1(\.0)?K$/)
    expect(formatCompactCurrency(1000000)).toMatch(/^\$1(\.0)?M$/)
  })

  it('formats with locale-specific currency', () => {
    // EUR locale - German formatting varies by Node version
    // May be "1000 €", "1.000 €", or "1000,0 €"
    expect(formatCompactCurrency(1000, 'de-DE')).toMatch(/1[,.]?000[,.]?0?\s*€/)

    // GBP for UK - may be "£1k" or "£1.0k"
    expect(formatCompactCurrency(1000, 'en-GB')).toMatch(/^£1(\.0)?k$/i)
  })
})
