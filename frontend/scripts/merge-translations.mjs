#!/usr/bin/env node
/**
 * Merge old translations with current en-US keys
 * Usage: node scripts/merge-translations.mjs
 *
 * Reads locale files from historical commits and merges them with
 * current en-US.json structure (keeping translated values, adding new keys)
 */
import { execSync } from 'child_process';
import fs from 'fs';

// Deep merge: use source structure, prefer target values
function deepMerge(source, target) {
  const result = {};
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target?.[key];

    if (typeof sourceVal === 'object' && sourceVal !== null && !Array.isArray(sourceVal)) {
      result[key] = deepMerge(sourceVal, targetVal || {});
    } else if (Array.isArray(sourceVal)) {
      result[key] = targetVal || sourceVal;
    } else {
      result[key] = targetVal !== undefined ? targetVal : sourceVal;
    }
  }
  return result;
}

// Commits with actual translations for each locale
const LOCALE_COMMITS = {
  'de-DE': '79dcc6f',  // feat(i18n): add en-GB and de-DE translations
  'es-ES': '6219fd3',  // feat(i18n): add nl-NL, es-ES, fr-FR translations
  'fr-FR': '6219fd3',  // feat(i18n): add nl-NL, es-ES, fr-FR translations
  'it-IT': 'faa1468',  // feat(i18n): add Italian (it-IT) translation
  'pt-PT': '1222af4',  // feat(i18n): add Portuguese (pt-PT) translation
};

// Read current en-US (source of truth for structure)
const enUS = JSON.parse(fs.readFileSync('src/messages/en-US.json', 'utf8'));

for (const [locale, commit] of Object.entries(LOCALE_COMMITS)) {
  const path = `src/messages/${locale}.json`;

  try {
    // Get old translations from git
    const oldContent = execSync(`git show ${commit}:frontend/${path}`, { encoding: 'utf8' });
    const oldTranslations = JSON.parse(oldContent);

    // Merge: en-US structure + old translations
    const merged = deepMerge(enUS, oldTranslations);

    fs.writeFileSync(path, JSON.stringify(merged, null, 2) + '\n');
    console.log(`✓ ${locale}.json merged from ${commit}`);
  } catch (e) {
    console.error(`✗ Failed to merge ${locale}: ${e.message}`);
  }
}

console.log('\nDone! Run `make translate-test` to check progress.');
