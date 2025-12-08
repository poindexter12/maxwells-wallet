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
  FORMAT_DELETE_BUTTON: 'format-delete-button',
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
  PURGE_BUTTON: 'purge-button', // Already exists - dangerous!

  // ============================================
  // Modals
  // ============================================
  MODAL_CONFIRM: 'modal-confirm',
  MODAL_CANCEL: 'modal-cancel',
  MODAL_CLOSE: 'modal-close',
} as const;

// Type for test ID values
export type TestId = (typeof TEST_IDS)[keyof typeof TEST_IDS];

// Helper to create data-testid attribute object (for spreading)
export const testId = (id: TestId) => ({ 'data-testid': id });
