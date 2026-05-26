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

  // Settings (provider / model / key)
  ASSISTANT_SETTINGS_TOGGLE: 'assistant-settings-toggle',
  ASSISTANT_PROVIDER_SELECT: 'assistant-provider-select',
  ASSISTANT_MODEL_INPUT: 'assistant-model-input',
  ASSISTANT_KEY_INPUT: 'assistant-key-input',
  ASSISTANT_SETTINGS_SAVE: 'assistant-settings-save',
} as const;
