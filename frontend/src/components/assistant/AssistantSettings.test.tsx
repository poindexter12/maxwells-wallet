import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AssistantSettings } from './AssistantSettings'
import { TEST_IDS } from '@/test-ids'
import type { AssistantConfig } from '@/lib/assistant'

const baseConfig: AssistantConfig = {
  provider: null,
  model: null,
  configured: false,
  source: 'env',
  available_providers: ['anthropic', 'openai'],
  default_models: { anthropic: 'claude-sonnet-4-6', openai: 'gpt-4o' },
}

describe('AssistantSettings (read-only status)', () => {
  it('shows provider and model when configured via env', () => {
    render(
      <AssistantSettings
        config={{ ...baseConfig, configured: true, provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    )
    expect(screen.getByTestId(TEST_IDS.ASSISTANT_SETTINGS_STATUS)).toHaveTextContent(/configured/i)
    expect(screen.getByText('anthropic')).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
  })

  it('shows guidance when not configured', () => {
    render(<AssistantSettings config={baseConfig} />)
    expect(screen.getByTestId(TEST_IDS.ASSISTANT_SETTINGS_STATUS)).toHaveTextContent(/not configured/i)
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument()
  })

  it('never renders a key input or save control (env-only config)', () => {
    const { container } = render(<AssistantSettings config={baseConfig} />)
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
