import { describe, it, expect } from 'vitest';
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
});
