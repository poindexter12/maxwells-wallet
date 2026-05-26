/**
 * AI assistant page test IDs.
 */
export const ASSISTANT_IDS = {
  ASSISTANT_PAGE: 'assistant-page',
  ASSISTANT_MESSAGES: 'assistant-messages',
  ASSISTANT_MESSAGE: 'assistant-message',
  ASSISTANT_INPUT: 'assistant-input',
  ASSISTANT_SEND: 'assistant-send',
  ASSISTANT_NOT_CONFIGURED: 'assistant-not-configured',

  // Proposal approval
  ASSISTANT_PROPOSAL: 'assistant-proposal',
  ASSISTANT_PROPOSAL_ACTION: 'assistant-proposal-action',
  ASSISTANT_PROPOSAL_EXECUTE: 'assistant-proposal-execute',
  ASSISTANT_PROPOSAL_CANCEL: 'assistant-proposal-cancel',

  // Settings (read-only status; configured via server env)
  ASSISTANT_SETTINGS_TOGGLE: 'assistant-settings-toggle',
  ASSISTANT_SETTINGS_STATUS: 'assistant-settings-status',
} as const;
