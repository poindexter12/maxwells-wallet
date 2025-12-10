/**
 * Internationalization (i18n) configuration for Maxwell's Wallet
 *
 * Supports 8 languages + pseudo for QA testing:
 * - en-US: English (United States) - default
 * - en-GB: English (United Kingdom)
 * - es: Spanish
 * - fr: French
 * - it: Italian
 * - pt: Portuguese
 * - de: German
 * - nl: Dutch
 * - pseudo: Pseudo-locale (QA testing) - auto-generated from en-US
 */

export const locales = ['en-US', 'en-GB', 'es', 'fr', 'it', 'pt', 'de', 'nl', 'pseudo'] as const;
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
  'pseudo': '[Ƥşḗḗŭŭḓǿǿ]',
};

// Helper to check if a locale is valid
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
