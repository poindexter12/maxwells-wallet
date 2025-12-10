/**
 * Tests for i18n translation completeness
 *
 * Ensures all translation files have the same keys as en-US.json (the source of truth)
 */
import { describe, it, expect } from 'vitest'
import enUS from '../messages/en-US.json'
import l33t from '../messages/l33t.json'

/**
 * Recursively extract all keys from a nested object
 * Returns flat keys like "common.save", "help.transactions.steps.0"
 */
function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  let keys: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (Array.isArray(value)) {
      // For arrays, add each index as a key
      value.forEach((_, index) => {
        keys.push(`${fullKey}.${index}`)
      })
    } else if (typeof value === 'object' && value !== null) {
      keys = keys.concat(getAllKeys(value as Record<string, unknown>, fullKey))
    } else {
      keys.push(fullKey)
    }
  }

  return keys
}

/**
 * Check that a translation file has no English strings
 * (useful for l33t speak where we want to ensure everything was translated)
 */
function findUnchangedStrings(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  prefix = ''
): string[] {
  const unchanged: string[] = []

  for (const [key, sourceValue] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const targetValue = target[key]

    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      sourceValue.forEach((item, index) => {
        if (typeof item === 'string' && item === targetValue[index]) {
          unchanged.push(`${fullKey}.${index}`)
        }
      })
    } else if (typeof sourceValue === 'object' && sourceValue !== null &&
               typeof targetValue === 'object' && targetValue !== null) {
      unchanged.push(...findUnchangedStrings(
        sourceValue as Record<string, unknown>,
        targetValue as Record<string, unknown>,
        fullKey
      ))
    } else if (typeof sourceValue === 'string' && sourceValue === targetValue) {
      unchanged.push(fullKey)
    }
  }

  return unchanged
}

describe('i18n translations', () => {
  const sourceKeys = new Set(getAllKeys(enUS))

  describe('en-US.json (source of truth)', () => {
    it('should have translation keys', () => {
      expect(sourceKeys.size).toBeGreaterThan(0)
    })
  })

  describe('l33t.json', () => {
    const l33tKeys = new Set(getAllKeys(l33t))

    it('should have all keys from en-US.json', () => {
      const missingKeys = [...sourceKeys].filter(key => !l33tKeys.has(key))

      if (missingKeys.length > 0) {
        throw new Error(
          `Missing ${missingKeys.length} translation keys in l33t.json:\n` +
          missingKeys.map(k => `  - ${k}`).join('\n')
        )
      }
    })

    it('should not have extra keys not in en-US.json', () => {
      const extraKeys = [...l33tKeys].filter(key => !sourceKeys.has(key))

      if (extraKeys.length > 0) {
        throw new Error(
          `Found ${extraKeys.length} extra keys in l33t.json not in en-US.json:\n` +
          extraKeys.map(k => `  + ${k}`).join('\n')
        )
      }
    })

    it('should have all strings translated (no unchanged English strings)', () => {
      const unchangedStrings = findUnchangedStrings(enUS, l33t)

      if (unchangedStrings.length > 0) {
        throw new Error(
          `Found ${unchangedStrings.length} untranslated strings in l33t.json ` +
          `(identical to en-US.json):\n` +
          unchangedStrings.map(k => `  = ${k}`).join('\n')
        )
      }
    })
  })
})
