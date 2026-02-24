import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { formatCurrency, formatAmount, formatCompactCurrency, formatDateShort, formatDateMedium } from './format'

describe('formatCurrency property-based tests', () => {
  it('never throws for any finite number', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(() => formatCurrency(n)).not.toThrow()
      }),
    )
  })

  it('always returns a non-empty string', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        const result = formatCurrency(n)
        expect(result.length).toBeGreaterThan(0)
      }),
    )
  })

  it('absolute value formatting is the same regardless of sign when showSign=false', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1e12, noNaN: true }),
        (n) => {
          const pos = formatCurrency(n)
          const neg = formatCurrency(-n)
          // Negative should be the positive with a minus prefix
          expect(neg).toBe(`-${pos}`)
        },
      ),
    )
  })

  it('showSign=true always prepends + or -', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        const result = formatCurrency(n, true)
        expect(result[0] === '+' || result[0] === '-').toBe(true)
      }),
    )
  })

  it('produces valid output for all supported locales', () => {
    const locales = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'pseudo']
    fc.assert(
      fc.property(
        fc.double({ min: -1e9, max: 1e9, noNaN: true }),
        fc.constantFrom(...locales),
        (n, locale) => {
          expect(() => formatCurrency(n, false, locale)).not.toThrow()
          const result = formatCurrency(n, false, locale)
          expect(result.length).toBeGreaterThan(0)
        },
      ),
    )
  })
})

describe('formatAmount property-based tests', () => {
  it('never throws for any finite number', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(() => formatAmount(n)).not.toThrow()
      }),
    )
  })

  it('does not contain currency symbols', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e9, noNaN: true }), (n) => {
        const result = formatAmount(n)
        expect(result).not.toMatch(/[$£€]/)
      }),
    )
  })
})

describe('formatCompactCurrency property-based tests', () => {
  it('never throws for any finite number', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (n) => {
        expect(() => formatCompactCurrency(n)).not.toThrow()
      }),
    )
  })

  it('compact output is generally shorter than or equal to full format for large values', () => {
    fc.assert(
      fc.property(fc.double({ min: 100_000, max: 1e12, noNaN: true }), (n) => {
        const compact = formatCompactCurrency(n)
        const full = formatCurrency(n)
        expect(compact.length).toBeLessThanOrEqual(full.length)
      }),
    )
  })
})

describe('formatDateShort property-based tests', () => {
  it('never throws for valid date timestamps', () => {
    // Dates between 1970-2099
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4102444800000 }), (ts) => {
        expect(() => formatDateShort(new Date(ts))).not.toThrow()
      }),
    )
  })

  it('always contains the year for dates in valid range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4102444800000 }), (ts) => {
        const date = new Date(ts)
        const result = formatDateShort(date)
        const year = date.getFullYear().toString()
        expect(result).toContain(year)
      }),
    )
  })
})

describe('formatDateMedium property-based tests', () => {
  it('never throws for valid date timestamps', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4102444800000 }), (ts) => {
        expect(() => formatDateMedium(new Date(ts))).not.toThrow()
      }),
    )
  })
})
