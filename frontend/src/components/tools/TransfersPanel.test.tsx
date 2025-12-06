import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransfersPanel from './TransfersPanel'

describe('TransfersPanel', () => {
  it('renders loading state initially', () => {
    render(<TransfersPanel />)
    expect(screen.getByTestId('transfers-loading')).toBeInTheDocument()
  })

  it('renders panel after loading', async () => {
    render(<TransfersPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('transfers-panel')).toBeInTheDocument()
    })
  })

  it('displays transfer stats', async () => {
    render(<TransfersPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('transfers-stats')).toBeInTheDocument()
    })
    expect(screen.getByText('Marked as Transfer')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('Transfer Total')).toBeInTheDocument()
    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
    expect(screen.getByText('Linked Pairs')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('displays suggestions list', async () => {
    render(<TransfersPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('transfers-suggestions')).toBeInTheDocument()
    })
    expect(screen.getByText('Suggested Transfers')).toBeInTheDocument()
    expect(screen.getByText('2 transactions look like transfers')).toBeInTheDocument()
  })

  it('displays suggestion rows', async () => {
    render(<TransfersPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-1')).toBeInTheDocument()
    })
    expect(screen.getByText('Transfer to Savings')).toBeInTheDocument()
    expect(screen.getByText('Checking')).toBeInTheDocument()
  })

  it('allows selecting suggestions', async () => {
    const user = userEvent.setup()
    render(<TransfersPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-1')).toBeInTheDocument()
    })

    // Click to select
    await user.click(screen.getByTestId('suggestion-row-1'))

    // Action buttons should appear
    await waitFor(() => {
      expect(screen.getByTestId('mark-transfers-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('Mark as Transfers (1)')).toBeInTheDocument()
  })

  it('allows selecting all suggestions', async () => {
    const user = userEvent.setup()
    render(<TransfersPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('select-all-checkbox')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('select-all-checkbox'))

    await waitFor(() => {
      expect(screen.getByText('Mark as Transfers (2)')).toBeInTheDocument()
    })
  })

  it('shows dismiss button when items selected', async () => {
    const user = userEvent.setup()
    render(<TransfersPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-row-1')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('suggestion-row-1'))

    await waitFor(() => {
      expect(screen.getByTestId('dismiss-btn')).toBeInTheDocument()
    })
    expect(screen.getByText('Dismiss (1)')).toBeInTheDocument()
  })
})
