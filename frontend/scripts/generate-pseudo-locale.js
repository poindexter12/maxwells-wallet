#!/usr/bin/env node
/**
 * Generates a pseudo-localized version of en-US.json for i18n testing.
 *
 * Pseudo-localization transforms text to make it obvious when:
 * 1. Text is hardcoded (not going through i18n)
 * 2. UI can't handle longer strings (padding simulates ~30% expansion)
 * 3. Character encoding issues exist (accents test unicode)
 *
 * Usage: node scripts/generate-pseudo-locale.js
 */

const fs = require('fs');
const path = require('path');
const { localize } = require('pseudo-localization');

const MESSAGES_DIR = path.join(__dirname, '../src/messages');
const SOURCE_FILE = path.join(MESSAGES_DIR, 'en-US.json');
const OUTPUT_FILE = path.join(MESSAGES_DIR, 'pseudo.json');

/**
 * Recursively transform all string values in an object
 */
function pseudoLocalizeObject(obj) {
  if (typeof obj === 'string') {
    // Skip ICU message format placeholders like {count} or {name}
    // and skip strings that are just placeholders
    if (obj.match(/^\{[^}]+\}$/)) {
      return obj;
    }
    // Pseudo-localize the string, preserving ICU placeholders
    return localize(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(pseudoLocalizeObject);
  }

  if (typeof obj === 'object' && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = pseudoLocalizeObject(value);
    }
    return result;
  }

  return obj;
}

// Read source file
console.log(`Reading source: ${SOURCE_FILE}`);
const sourceContent = fs.readFileSync(SOURCE_FILE, 'utf8');
const sourceMessages = JSON.parse(sourceContent);

// Transform
console.log('Generating pseudo-localized messages...');
const pseudoMessages = pseudoLocalizeObject(sourceMessages);

// Write output
console.log(`Writing output: ${OUTPUT_FILE}`);
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pseudoMessages, null, 2) + '\n');

console.log('Done! Pseudo-locale generated successfully.');
console.log('\nExample transformations:');
console.log(`  "Loading..." → "${localize('Loading...')}"`);
console.log(`  "Save" → "${localize('Save')}"`);
console.log(`  "Dashboard" → "${localize('Dashboard')}"`);
