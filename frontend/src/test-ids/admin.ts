/**
 * Admin page test IDs.
 */
export const ADMIN_IDS = {
  ADMIN_TAB_OVERVIEW: 'admin-tab-overview',
  ADMIN_TAB_IMPORTS: 'admin-tab-imports',

  // Admin Overview
  OVERVIEW_STATS: 'overview-stats',
  OVERVIEW_STAT_TOTAL_TRANSACTIONS: 'overview-stat-total-transactions',
  OVERVIEW_STAT_TOTAL_TRANSACTIONS_VALUE: 'overview-stat-total-transactions-value',
  OVERVIEW_STAT_IMPORT_SESSIONS: 'overview-stat-import-sessions',
  OVERVIEW_STAT_IMPORT_SESSIONS_VALUE: 'overview-stat-import-sessions-value',
  OVERVIEW_STAT_COMPLETED_IMPORTS: 'overview-stat-completed-imports',
  OVERVIEW_STAT_COMPLETED_IMPORTS_VALUE: 'overview-stat-completed-imports-value',
  OVERVIEW_STAT_ROLLED_BACK: 'overview-stat-rolled-back',
  OVERVIEW_STAT_ROLLED_BACK_VALUE: 'overview-stat-rolled-back-value',
  OVERVIEW_ACCOUNT_STATS: 'overview-account-stats',
  OVERVIEW_DANGER_ZONE: 'overview-danger-zone',

  // Admin Tags
  TAGS_TAB_DESCRIPTION: 'tags-tab-description',
  TAGS_TAB_ADD_BUTTON: 'tags-tab-add-button',
  TAGS_TAB_LOADING: 'tags-tab-loading',
  TAGS_TAB_EMPTY: 'tags-tab-empty',
  TAGS_TAB_TABLE: 'tags-tab-table',

  // Admin Backups
  ADMIN_TAB_BACKUPS: 'admin-tab-backups',
  BACKUP_LIST: 'backup-list',
  BACKUP_CREATE_BUTTON: 'backup-create-button',
  BACKUP_SCHEDULE_TOGGLE: 'backup-schedule-toggle',
  BACKUP_SCHEDULE_INTERVAL: 'backup-schedule-interval',
  BACKUP_LOADING: 'backup-loading',
  BACKUP_EMPTY: 'backup-empty',

  // API tokens
  API_TOKENS_SECTION: 'api-tokens-section',
  API_TOKENS_LIST: 'api-tokens-list',
  API_TOKENS_EMPTY: 'api-tokens-empty',
  API_TOKEN_NAME_INPUT: 'api-token-name-input',
  API_TOKEN_SCOPE_SELECT: 'api-token-scope-select',
  API_TOKEN_EXPIRY_SELECT: 'api-token-expiry-select',
  API_TOKEN_CREATE_BUTTON: 'api-token-create-button',
  API_TOKEN_ERROR: 'api-token-error',
  API_TOKEN_CREATED_NOTICE: 'api-token-created-notice',
  API_TOKEN_VALUE: 'api-token-value',
  API_TOKEN_CONNECTION_SNIPPET: 'api-token-connection-snippet',
  API_TOKEN_COPY_BUTTON: 'api-token-copy-button',
  API_TOKEN_DISMISS_BUTTON: 'api-token-dismiss-button',
  API_TOKEN_REVOKE_CONFIRM_BUTTON: 'api-token-revoke-confirm-button',
  API_TOKEN_REVOKE_CANCEL_BUTTON: 'api-token-revoke-cancel-button',
} as const;
