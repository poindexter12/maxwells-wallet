import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AssistantSettings } from './AssistantSettings'
import { TEST_IDS } from '@/test-ids'
import type { AssistantConfig } from '@/lib/assistant'

const updateAssistantConfig = vi.fn()
vi.mock('@/lib/assistant', () => ({
  updateAssistantConfig: (...args: unknown[]) => updateAssistantConfig(...args),
}))

const baseConfig: AssistantConfig = {
  provider: null,
  model: null,
  configured: false,
  key_stored: false,
  available_providers: ['anthropic', 'openai'],
  default_models: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o' },
}

describe('AssistantSettings', () => {
  beforeEach(() => {
    updateAssistantConfig.mockReset()
  })

  it('saves provider + key and clears the key field afterward', async () => {
    updateAssistantConfig.mockResolvedValue({ ...baseConfig, provider: 'anthropic', configured: true, key_stored: true })
    const onSaved = vi.fn()
    render(<AssistantSettings config={baseConfig} onSaved={onSaved} />)

    const keyInput = screen.getByTestId(TEST_IDS.ASSISTANT_KEY_INPUT) as HTMLInputElement
    // The key field is a password input (write-only UI).
    expect(keyInput.type).toBe('password')

    fireEvent.change(keyInput, { target: { value: 'sk-secret' } })
    fireEvent.click(screen.getByTestId(TEST_IDS.ASSISTANT_SETTINGS_SAVE))

    await waitFor(() =>
      expect(updateAssistantConfig).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'anthropic', api_key: 'sk-secret' }),
      ),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    // Key field cleared after save so the secret isn't left in the DOM.
    expect(keyInput.value).toBe('')
  })

  it('does not send api_key when the field is left blank', async () => {
    updateAssistantConfig.mockResolvedValue({ ...baseConfig, configured: true })
    render(<AssistantSettings config={{ ...baseConfig, key_stored: true, provider: 'anthropic' }} onSaved={vi.fn()} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.ASSISTANT_SETTINGS_SAVE))

    await waitFor(() => expect(updateAssistantConfig).toHaveBeenCalled())
    const arg = updateAssistantConfig.mock.calls[0][0]
    expect(arg.api_key).toBeUndefined()
  })
})
