/**
 * Transactions page test IDs.
 */
export const TRANSACTIONS_IDS = {
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
  FILTER_TRANSFERS: 'filter-transfers',

  // Quick filters - Date
  QUICK_FILTER_THIS_MONTH: 'quick-filter-this-month',
  QUICK_FILTER_LAST_MONTH: 'quick-filter-last-month',
  QUICK_FILTER_THIS_YEAR: 'quick-filter-this-year',
  QUICK_FILTER_YTD: 'quick-filter-ytd',
  QUICK_FILTER_LAST_90_DAYS: 'quick-filter-last-90-days',

  // Quick filters - Insights
  QUICK_FILTER_LARGE_DYNAMIC: 'quick-filter-large-dynamic',
  QUICK_FILTER_TOP_SPENDING: 'quick-filter-top-spending',
  QUICK_FILTER_LARGE: 'quick-filter-large',
  QUICK_FILTER_UNRECONCILED: 'quick-filter-unreconciled',

  // Bulk operations
  BULK_SELECT_ALL: 'bulk-select-all',
  BULK_ACTION_SELECT: 'bulk-action-select',
  BULK_APPLY_BUTTON: 'bulk-apply-button',

  // Split Transaction
  SPLIT_LOADING: 'split-loading',
  SPLIT_BUCKET_SELECT: 'split-bucket-select',
  SPLIT_BUCKET_PLACEHOLDER: 'split-bucket-placeholder',
  SPLIT_REMOVE_BUTTON: 'split-remove-button',
} as const;
