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
const UNIVERSAL_STRINGS = new Set(getAllKeys(universal as Record<string, unknown>))

// Production locales to test (excluding en-GB which shares most strings with en-US)
const PRODUCTION_LOCALES = ['de-DE', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT'] as const

// Minimum percentage of strings that must be different from English
const MIN_TRANSLATION_PERCENT = 100

// Keys that are pending translation (recently added to en-US.json, awaiting Crowdin sync)
// Remove keys from this list once translations are available
const PENDING_TRANSLATION_KEYS = new Set([
  'admin.tabs.security',
  'auth.login.title',
  'auth.login.subtitle',
  'auth.login.username',
  'auth.login.password',
  'auth.login.submit',
  'auth.login.forgotPassword',
  'auth.setup.title',
  'auth.setup.subtitle',
  'auth.setup.username',
  'auth.setup.password',
  'auth.setup.confirmPassword',
  'auth.setup.submit',
  'auth.setup.passwordMismatch',
  'auth.setup.passwordTooShort',
  'auth.changePassword.title',
  'auth.changePassword.currentPassword',
  'auth.changePassword.newPassword',
  'auth.changePassword.confirmPassword',
  'auth.changePassword.submit',
  'auth.changePassword.success',
  'auth.changePassword.passwordMismatch',
  'auth.changePassword.passwordTooShort',
  'auth.logout',
  'auth.errors.INVALID_CREDENTIALS',
  'auth.errors.NOT_AUTHENTICATED',
  'auth.errors.SETUP_ALREADY_COMPLETE',
  'auth.errors.INVALID_PASSWORD',
  'auth.errors.LOGIN_FAILED',
  'auth.errors.SETUP_FAILED',
])

describe('i18n translations', () => {
  const sourceKeys = new Set(getAllKeys(enUS))

  describe('en-US.json (source of truth)', () => {
    it('should have translation keys', () => {
      expect(sourceKeys.size).toBeGreaterThan(0)
    })
  })

  // Test each production locale for actual translations
  describe.each(PRODUCTION_LOCALES)('%s translations', (locale) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const localeData = require(`../messages/${locale}.json`) as Record<string, unknown>

    it('should have all keys from en-US.json', () => {
      const localeKeys = new Set(getAllKeys(localeData))
      const missingKeys = [...sourceKeys].filter(key =>
        !localeKeys.has(key) && !PENDING_TRANSLATION_KEYS.has(key)
      )

      if (missingKeys.length > 0) {
        throw new Error(
          `Missing ${missingKeys.length} translation keys in ${locale}.json:\n` +
          missingKeys.slice(0, 20).map(k => `  - ${k}`).join('\n') +
          (missingKeys.length > 20 ? `\n  ... and ${missingKeys.length - 20} more` : '')
        )
      }
    })

    it(`should have ${MIN_TRANSLATION_PERCENT}% of strings translated (not identical to English)`, () => {
      const unchangedStrings = findUnchangedStrings(enUS, localeData)
        .filter(key => !UNIVERSAL_STRINGS.has(key))

      const totalStrings = sourceKeys.size
      const translatedPercent = ((totalStrings - unchangedStrings.length) / totalStrings) * 100

      if (translatedPercent < MIN_TRANSLATION_PERCENT) {
        throw new Error(
          `${locale}.json has only ${translatedPercent.toFixed(1)}% translated ` +
          `(${unchangedStrings.length} strings identical to English).\n` +
          `Expected at least ${MIN_TRANSLATION_PERCENT}%.\n` +
          `First 20 untranslated:\n` +
          unchangedStrings.slice(0, 20).map(k => `  = ${k}`).join('\n') +
          (unchangedStrings.length > 20 ? `\n  ... and ${unchangedStrings.length - 20} more` : '')
        )
      }
    })
  })

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
      const missingKeys = [...sourceKeys].filter(key =>
        !pseudoKeys.has(key) && !PENDING_TRANSLATION_KEYS.has(key)
      )

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
