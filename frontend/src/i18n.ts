/**
 * Internationalization (i18n) configuration for Maxwell's Wallet
 *
 * Supports 8 languages + l33t for QA testing:
 * - en-US: English (United States) - default
 * - en-GB: English (United Kingdom)
 * - es: Spanish
 * - fr: French
 * - it: Italian
 * - pt: Portuguese
 * - de: German
 * - nl: Dutch
 * - l33t: Leet speak (QA testing)
 */

export const locales = ['en-US', 'en-GB', 'es', 'fr', 'it', 'pt', 'de', 'nl', 'l33t'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en-US';

// Language display names (in their native language)
export const languageNames: Record<Locale, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es': 'Espanol',
  'fr': 'Francais',
  'it': 'Italiano',
  'pt': 'Portugues',
  'de': 'Deutsch',
  'nl': 'Nederlands',
  'l33t': 'l33t 5p34k',
};

// Helper to check if a locale is valid
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
