/**
 * Internationalization (i18n) configuration for Maxwell's Wallet
 *
 * Supports 8 languages:
 * - en-US: English (United States) - default
 * - en-GB: English (United Kingdom)
 * - es-ES: Spanish (Spain)
 * - fr-FR: French (France)
 * - it-IT: Italian (Italy)
 * - pt-PT: Portuguese (Portugal)
 * - de-DE: German (Germany)
 * - nl-NL: Dutch (Netherlands)
 *
 * In development, a 'pseudo' locale is available for QA testing.
 * Generate it with: make i18n-pseudo
 */

// Production locales (always available)
const productionLocales = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'it-IT', 'pt-PT', 'de-DE', 'nl-NL'] as const;

// Dev-only locale for QA testing (not shipped to production)
const devLocales = ['pseudo'] as const;

// Combined locales based on environment
// Pseudo locale is available in development OR when explicitly enabled (e.g., Docker QA builds)
const enablePseudo = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_PSEUDO === 'true';
export const locales = enablePseudo
  ? ([...productionLocales, ...devLocales] as const)
  : productionLocales;

export type Locale = (typeof productionLocales)[number] | (typeof devLocales)[number];
export const defaultLocale: Locale = 'en-US';

// Language display names (in their native language) with flag emojis
export const languageNames: Record<Locale, string> = {
  'en-US': '🇺🇸 English (US)',
  'en-GB': '🇬🇧 English (UK)',
  'es-ES': '🇪🇸 Español',
  'fr-FR': '🇫🇷 Français',
  'it-IT': '🇮🇹 Italiano',
  'de-DE': '🇩🇪 Deutsch',
  'nl-NL': '🇳🇱 Nederlands',
  'pt-PT': '🇵🇹 Português',
  'pseudo': '🔤 [Ƥşḗḗŭŭḓǿǿ]',
};

// Helper to check if a locale is valid
export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}
