/**
 * Test IDs for authentication pages and components.
 */
export const AUTH_IDS = {
  // Setup page
  SETUP_USERNAME: 'setup-username',
  SETUP_PASSWORD: 'setup-password',
  SETUP_CONFIRM_PASSWORD: 'setup-confirm-password',
  SETUP_SUBMIT: 'setup-submit',
  SETUP_ERROR: 'setup-error',
  SETUP_LOADING: 'setup-loading',

  // Login page
  LOGIN_USERNAME: 'login-username',
  LOGIN_PASSWORD: 'login-password',
  LOGIN_SUBMIT: 'login-submit',
  LOGIN_ERROR: 'login-error',
  LOGIN_LOADING: 'login-loading',

  // Auth states (shown during redirects)
  AUTH_REDIRECTING: 'auth-redirecting',
  AUTH_LOADING: 'auth-loading',
} as const;
