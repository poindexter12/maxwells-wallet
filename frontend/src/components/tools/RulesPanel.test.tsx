import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RulesPanel from './RulesPanel'

describe('RulesPanel', () => {
  it('renders loading state initially', () => {
    render(<RulesPanel />)
    expect(screen.getByTestId('rules-loading')).toBeInTheDocument()
  })

  it('renders panel after loading', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('rules-panel')).toBeInTheDocument()
    })
  })

  it('displays rules list', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('rules-list')).toBeInTheDocument()
    })
  })

  it('displays existing rule', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('rule-row-1')).toBeInTheDocument()
    })
    expect(screen.getByText('Coffee shops')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Priority: 10')).toBeInTheDocument()
  })

  it('shows rule conditions', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByText('Merchant: "Starbucks"')).toBeInTheDocument()
    })
  })

  it('displays match count', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByText('Matched: 25 transactions')).toBeInTheDocument()
    })
  })

  it('has new rule button', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('new-rule-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('New Rule')).toBeInTheDocument()
  })

  it('has apply all rules button', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('apply-rules-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('Apply All Rules')).toBeInTheDocument()
  })

  it('opens create form when new rule clicked', async () => {
    const user = userEvent.setup()
    render(<RulesPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('new-rule-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('new-rule-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('rule-form-modal')).toBeInTheDocument()
    })
    expect(screen.getByText('Create Rule')).toBeInTheDocument()
  })

  it('form has required fields', async () => {
    const user = userEvent.setup()
    render(<RulesPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('new-rule-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('new-rule-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('rule-name-input')).toBeInTheDocument()
    })
    expect(screen.getByTestId('rule-tag-select')).toBeInTheDocument()
    expect(screen.getByTestId('rule-merchant-input')).toBeInTheDocument()
    expect(screen.getByTestId('rule-description-input')).toBeInTheDocument()
  })

  it('can close form with cancel', async () => {
    const user = userEvent.setup()
    render(<RulesPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('new-rule-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('new-rule-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('rule-cancel-btn')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('rule-cancel-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId('rule-form-modal')).not.toBeInTheDocument()
    })
  })

  it('has enabled/disabled toggle per rule', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('toggle-enabled-1')).toBeInTheDocument()
    })
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('has test, edit, delete buttons per rule', async () => {
    render(<RulesPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('test-rule-1')).toBeInTheDocument()
    })
    expect(screen.getByTestId('edit-rule-1')).toBeInTheDocument()
    expect(screen.getByTestId('delete-rule-1')).toBeInTheDocument()
  })
})
