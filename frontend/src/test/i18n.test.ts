/**
 * Tests for i18n translation completeness
 *
 * Ensures all translation files have the same keys as en-US.json (the source of truth)
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import enUS from '../messages/en-US.json'
import universal from '../messages/universal.json'

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
 * Check if a string has transformable text outside of ICU placeholders.
 * Strings like "{value} ({namespace})" have no letters to transform.
 */
function hasTransformableText(str: string): boolean {
  // Remove all ICU placeholders
  const withoutPlaceholders = str.replace(/\{[^}]+\}/g, '')
  // Check if there are any letters remaining
  return /[a-zA-Z]/.test(withoutPlaceholders)
}

/**
 * Check that a translation file has no English strings
 * (useful for pseudo locale where we want to ensure everything was translated)
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
          // Skip strings with no transformable text (only placeholders)
          if (hasTransformableText(item)) {
            unchanged.push(`${fullKey}.${index}`)
          }
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
      // Skip strings with no transformable text (only placeholders)
      if (hasTransformableText(sourceValue)) {
        unchanged.push(fullKey)
      }
    }
  }

  return unchanged
}

// Universal strings from universal.json - intentionally same across all languages
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UNIVERSAL_STRINGS = new Set(getAllKeys(universal as Record<string, unknown>))


describe('i18n translations', () => {
  const sourceKeys = new Set(getAllKeys(enUS))

  describe('en-US.json (source of truth)', () => {
    it('should have translation keys', () => {
      expect(sourceKeys.size).toBeGreaterThan(0)
    })
  })

  // Note: We don't test that all locales have all keys from en-US.json
  // Crowdin manages translations and syncs new keys automatically.
  // The pseudo locale tests below verify the source strings are valid.

  // pseudo.json is gitignored and only available in dev when generated
  // Skip these tests if the file doesn't exist (e.g., in CI)
  const pseudoPath = join(__dirname, '../messages/pseudo.json')
  const hasPseudo = existsSync(pseudoPath)

  describe.skipIf(!hasPseudo)('pseudo.json (dev-only, run `make i18n-pseudo` to generate)', () => {
    // Dynamic import since file may not exist
    let pseudo: Record<string, unknown>

    it('should load pseudo.json', async () => {
      pseudo = (await import('../messages/pseudo.json')).default
      expect(pseudo).toBeDefined()
    })

    it('should have all keys from en-US.json', () => {
      const pseudoKeys = new Set(getAllKeys(pseudo))
      const missingKeys = [...sourceKeys].filter(key => !pseudoKeys.has(key))

      if (missingKeys.length > 0) {
        throw new Error(
          `Missing ${missingKeys.length} translation keys in pseudo.json:\n` +
          missingKeys.map(k => `  - ${k}`).join('\n')
        )
      }
    })

    it('should not have extra keys not in en-US.json', () => {
      const pseudoKeys = new Set(getAllKeys(pseudo))
      const extraKeys = [...pseudoKeys].filter(key => !sourceKeys.has(key))

      if (extraKeys.length > 0) {
        throw new Error(
          `Found ${extraKeys.length} extra keys in pseudo.json not in en-US.json:\n` +
          extraKeys.map(k => `  + ${k}`).join('\n')
        )
      }
    })

    it('should have all strings transformed (no unchanged English strings)', () => {
      const unchangedStrings = findUnchangedStrings(enUS, pseudo)

      if (unchangedStrings.length > 0) {
        throw new Error(
          `Found ${unchangedStrings.length} untransformed strings in pseudo.json ` +
          `(identical to en-US.json):\n` +
          unchangedStrings.map(k => `  = ${k}`).join('\n')
        )
      }
    })
  })
})
