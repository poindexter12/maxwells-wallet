/**
 * Test IDs for destructive/dangerous actions that chaos tests should NEVER click.
 *
 * These are kept in a separate group so:
 * 1. They can't accidentally be added to TEST_IDS
 * 2. Chaos tests can easily exclude all of them
 * 3. The intent is clear - these actions have irreversible consequences
 *
 * Usage in components:
 *   import { CHAOS_EXCLUDED_IDS } from '@/test-ids';
 *   <button data-testid={CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA}>Purge</button>
 *
 * Usage in chaos tests:
 *   import { getChaosExcludeSelectors } from '@/test-ids';
 *   performRandomActions(page, { excludeSelectors: getChaosExcludeSelectors() });
 */
export const CHAOS_EXCLUDED_IDS = {
  // Destructive data operations
  PURGE_ALL_DATA: 'purge-all-data', // Deletes ALL transactions
  DELETE_ACCOUNT: 'delete-account', // Deletes an account and its transactions
  ROLLBACK_IMPORT: 'rollback-import', // Deletes an entire import session

  // Bulk destructive operations
  BULK_DELETE: 'bulk-delete', // Bulk delete selected items

  // Format/config deletions
  FORMAT_DELETE_BUTTON: 'format-delete-button', // Delete saved CSV format
  RULE_DELETE_BUTTON: 'rule-delete-button', // Delete tag rule
  TAG_DELETE_BUTTON: 'tag-delete-button', // Delete tag

  // Confirmation buttons in destructive modals
  CONFIRM_DELETE: 'confirm-delete', // Generic delete confirmation
  CONFIRM_PURGE: 'confirm-purge', // Purge confirmation
} as const;

/**
 * Get all chaos-excluded selectors for use in chaos tests.
 * Returns array of CSS selectors like '[data-testid="purge-all-data"]'
 */
export function getChaosExcludeSelectors(): string[] {
  return Object.values(CHAOS_EXCLUDED_IDS).map(
    (id) => `[data-testid="${id}"]`
  );
}
