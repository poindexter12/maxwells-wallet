import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';
import {
  TEST_IDS,
  CHAOS_EXCLUDED_IDS,
  validateNoTestIdOverlap,
  getChaosExcludeSelectors,
} from './test-ids';

describe('test-ids', () => {
  it('should have no overlap between TEST_IDS and CHAOS_EXCLUDED_IDS', () => {
    // This will throw if there's overlap
    expect(() => validateNoTestIdOverlap()).not.toThrow();
  });

  it('should have unique values in TEST_IDS', () => {
    const values = Object.values(TEST_IDS);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it('should have unique values in CHAOS_EXCLUDED_IDS', () => {
    const values = Object.values(CHAOS_EXCLUDED_IDS);
    const uniqueValues = new Set(values);
    expect(values.length).toBe(uniqueValues.size);
  });

  it('should generate valid CSS selectors from getChaosExcludeSelectors', () => {
    const selectors = getChaosExcludeSelectors();

    expect(selectors.length).toBe(Object.keys(CHAOS_EXCLUDED_IDS).length);

    for (const selector of selectors) {
      expect(selector).toMatch(/^\[data-testid="[a-z0-9-]+"\]$/);
    }
  });

  it('should have kebab-case values in TEST_IDS', () => {
    for (const [key, value] of Object.entries(TEST_IDS)) {
      expect(value).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        `TEST_IDS.${key} should be kebab-case, got: ${value}`
      );
    }
  });

  it('should have kebab-case values in CHAOS_EXCLUDED_IDS', () => {
    for (const [key, value] of Object.entries(CHAOS_EXCLUDED_IDS)) {
      expect(value).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        `CHAOS_EXCLUDED_IDS.${key} should be kebab-case, got: ${value}`
      );
    }
  });

  // These tests scan the filesystem and can be slow
  describe('TEST_IDS usage validation', { timeout: 30000 }, () => {
    // Get all TEST_IDS references from source files (excluding test files and test-ids definition)
    const getTestIdReferencesFromSource = (): Set<string> => {
      const frontendDir = path.resolve(__dirname, '..');
      const references = new Set<string>();

      try {
        // Search for TEST_IDS.KEY or CHAOS_EXCLUDED_IDS.KEY in TSX/TS files
        // Pattern matches identifier names (uppercase letters, digits, underscores)
        // Exclude test files and test-ids definition files
        const result = execSync(
          `grep -rhoE '(TEST_IDS|CHAOS_EXCLUDED_IDS)\\.[A-Z][A-Z0-9_]*' --include='*.tsx' --include='*.ts' --exclude='*.test.ts' --exclude='*.test.tsx' --exclude='test-ids.ts' --exclude='test-ids.test.ts' . | sort -u`,
          { cwd: frontendDir, encoding: 'utf-8' }
        );

        for (const line of result.trim().split('\n')) {
          if (line) references.add(line);
        }
      } catch {
        // grep returns exit code 1 if no matches found
      }

      return references;
    };

    // Get all TEST_IDS references from test files (excluding this validation test)
    const getTestIdReferencesFromTests = (): Set<string> => {
      const frontendDir = path.resolve(__dirname, '..');
      const references = new Set<string>();

      try {
        const result = execSync(
          `grep -rhoE '(TEST_IDS|CHAOS_EXCLUDED_IDS)\\.[A-Z][A-Z0-9_]*' --include='*.test.ts' --include='*.test.tsx' --exclude='test-ids.test.ts' . | sort -u`,
          { cwd: frontendDir, encoding: 'utf-8' }
        );

        for (const line of result.trim().split('\n')) {
          if (line) references.add(line);
        }
      } catch {
        // grep returns exit code 1 if no matches found
      }

      return references;
    };

    it('all TEST_IDS used in source files should exist', () => {
      const sourceRefs = getTestIdReferencesFromSource();
      const allDefinedKeys = new Set([
        ...Object.keys(TEST_IDS).map((k) => `TEST_IDS.${k}`),
        ...Object.keys(CHAOS_EXCLUDED_IDS).map((k) => `CHAOS_EXCLUDED_IDS.${k}`),
      ]);

      const undefinedRefs: string[] = [];
      for (const ref of sourceRefs) {
        if (!allDefinedKeys.has(ref)) {
          undefinedRefs.push(ref);
        }
      }

      expect(
        undefinedRefs,
        `These TEST_IDS are used in source but not defined: ${undefinedRefs.join(', ')}`
      ).toEqual([]);
    });

    it('all TEST_IDS used in test files should exist', () => {
      const testRefs = getTestIdReferencesFromTests();
      const allDefinedKeys = new Set([
        ...Object.keys(TEST_IDS).map((k) => `TEST_IDS.${k}`),
        ...Object.keys(CHAOS_EXCLUDED_IDS).map((k) => `CHAOS_EXCLUDED_IDS.${k}`),
      ]);

      const undefinedRefs: string[] = [];
      for (const ref of testRefs) {
        if (!allDefinedKeys.has(ref)) {
          undefinedRefs.push(ref);
        }
      }

      expect(
        undefinedRefs,
        `These TEST_IDS are used in tests but not defined: ${undefinedRefs.join(', ')}`
      ).toEqual([]);
    });

    it('all defined TEST_IDS should be used somewhere', () => {
      const sourceRefs = getTestIdReferencesFromSource();
      const testRefs = getTestIdReferencesFromTests();
      const allRefs = new Set([...sourceRefs, ...testRefs]);

      const unusedIds: string[] = [];

      // Check TEST_IDS
      for (const key of Object.keys(TEST_IDS)) {
        const fullRef = `TEST_IDS.${key}`;
        if (!allRefs.has(fullRef)) {
          unusedIds.push(fullRef);
        }
      }

      // Check CHAOS_EXCLUDED_IDS
      for (const key of Object.keys(CHAOS_EXCLUDED_IDS)) {
        const fullRef = `CHAOS_EXCLUDED_IDS.${key}`;
        if (!allRefs.has(fullRef)) {
          unusedIds.push(fullRef);
        }
      }

      expect(
        unusedIds,
        `These TEST_IDS are defined but never used - remove them or add tests: ${unusedIds.join(', ')}`
      ).toEqual([]);
    });
  });
});
