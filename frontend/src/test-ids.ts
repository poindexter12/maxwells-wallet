/**
 * Centralized test ID constants for E2E testing.
 *
 * Usage in components:
 *   import { TEST_IDS } from '@/test-ids';
 *   <button data-testid={TEST_IDS.HELP_DISMISS}>Got it</button>
 *
 * Usage in tests:
 *   import { TEST_IDS } from '../src/test-ids';
 *   await page.locator(`[data-testid="${TEST_IDS.HELP_DISMISS}"]`).click();
 *
 * Naming convention: SCREAMING_SNAKE_CASE matching the testid value
 */

export const TEST_IDS = {
  // ============================================
  // Global / Shared
  // ============================================
  HELP_DISMISS: 'help-dismiss',
  THEME_SELECTOR: 'theme-selector',

  // ============================================
  // Dashboard
  // ============================================
  DASHBOARD_PAGE: 'dashboard-page',
  DASHBOARD_SELECTOR: 'dashboard-selector', // Already exists in codebase
  DASHBOARD_TAB: 'dashboard-tab',
  DASHBOARD_ADD_BUTTON: 'dashboard-add-button',

  // ============================================
  // Transactions
  // ============================================
  TRANSACTIONS_PAGE: 'transactions-page',
  TRANSACTIONS_LIST: 'transactions-list',
  TRANSACTIONS_ROW: 'transactions-row',

  // Filters
  FILTER_SEARCH: 'filter-search',
  FILTER_BUCKET: 'filter-bucket',
  FILTER_STATUS: 'filter-status',
  FILTER_OCCASION: 'filter-occasion',
  FILTER_ACCOUNT: 'filter-account',
  FILTER_AMOUNT_MIN: 'filter-amount-min',
  FILTER_AMOUNT_MAX: 'filter-amount-max',
  FILTER_DATE_START: 'filter-date-start',
  FILTER_DATE_END: 'filter-date-end',
  FILTER_CLEAR: 'filter-clear',
  FILTER_ADVANCED_TOGGLE: 'filter-advanced-toggle',

  // Quick filters
  QUICK_FILTER_THIS_MONTH: 'quick-filter-this-month',
  QUICK_FILTER_LAST_MONTH: 'quick-filter-last-month',
  QUICK_FILTER_LARGE: 'quick-filter-large',
  QUICK_FILTER_UNRECONCILED: 'quick-filter-unreconciled',

  // Bulk operations
  BULK_SELECT_ALL: 'bulk-select-all',
  BULK_ACTION_SELECT: 'bulk-action-select',
  BULK_APPLY_BUTTON: 'bulk-apply-button',

  // ============================================
  // Import
  // ============================================
  IMPORT_PAGE: 'import-page',
  IMPORT_FILE_INPUT: 'import-file-input',
  IMPORT_ACCOUNT_SELECT: 'import-account-select',
  IMPORT_FORMAT_SELECT: 'import-format-select',
  IMPORT_PREVIEW_BUTTON: 'import-preview-button',
  IMPORT_CONFIRM_BUTTON: 'import-confirm-button',
  IMPORT_MODE_TOGGLE: 'import-mode-toggle',

  // ============================================
  // Tools
  // ============================================
  TOOLS_PAGE: 'tools-page',
  TOOLS_TAB_FORMATS: 'tools-tab-formats',
  TOOLS_TAB_RULES: 'tools-tab-rules',
  TOOLS_TAB_MERCHANTS: 'tools-tab-merchants',
  TOOLS_TAB_TRANSFERS: 'tools-tab-transfers',

  // Custom formats
  FORMAT_CREATE_BUTTON: 'format-create-button',
  FORMAT_LIST: 'format-list',
  FORMAT_ITEM: 'format-item',
  FORMAT_EDIT_BUTTON: 'format-edit-button',
  FORMAT_TEST_BUTTON: 'format-test-button',

  // ============================================
  // Budgets
  // ============================================
  BUDGETS_PAGE: 'budgets-page',
  BUDGETS_LIST: 'budgets-list',
  BUDGET_ITEM: 'budget-item',
  BUDGET_PROGRESS: 'budget-progress',

  // ============================================
  // Admin
  // ============================================
  ADMIN_PAGE: 'admin-page',
  ADMIN_TAB_OVERVIEW: 'admin-tab-overview',
  ADMIN_TAB_IMPORTS: 'admin-tab-imports',
  ADMIN_TAB_TAGS: 'admin-tab-tags',

  // ============================================
  // Modals
  // ============================================
  MODAL_CONFIRM: 'modal-confirm',
  MODAL_CANCEL: 'modal-cancel',
  MODAL_CLOSE: 'modal-close',
} as const;

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
 *   import { getChaosExcludeSelectors } from '../src/test-ids';
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

// Type for regular test ID values
export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS];

// Type for chaos-excluded test ID values
export type ChaosExcludedId =
  (typeof CHAOS_EXCLUDED_IDS)[keyof typeof CHAOS_EXCLUDED_IDS];

// Combined type for all test IDs
export type AnyTestId = TestId | ChaosExcludedId;

// Helper to create data-testid attribute object (for spreading)
export const testId = (id: AnyTestId) => ({ 'data-testid': id });

/**
 * Get all chaos-excluded selectors for use in chaos tests.
 * Returns array of CSS selectors like '[data-testid="purge-all-data"]'
 */
export function getChaosExcludeSelectors(): string[] {
  return Object.values(CHAOS_EXCLUDED_IDS).map(
    (id) => `[data-testid="${id}"]`
  );
}

/**
 * Validate that no IDs appear in both TEST_IDS and CHAOS_EXCLUDED_IDS.
 * Call this in a test to catch accidental duplicates.
 * Throws an error if overlap is found.
 */
export function validateNoTestIdOverlap(): void {
  const regularIds = new Set(Object.values(TEST_IDS));
  const excludedIds = new Set(Object.values(CHAOS_EXCLUDED_IDS));

  const overlap: string[] = [];
  for (const id of regularIds) {
    if (excludedIds.has(id as ChaosExcludedId)) {
      overlap.push(id);
    }
  }

  if (overlap.length > 0) {
    throw new Error(
      `Test ID overlap detected! The following IDs appear in both TEST_IDS and CHAOS_EXCLUDED_IDS: ${overlap.join(', ')}. ` +
        `Move them to only ONE group.`
    );
  }
}
