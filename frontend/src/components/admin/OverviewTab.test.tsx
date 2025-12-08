import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverviewTab } from './OverviewTab'
import { AdminStats } from '@/types/admin'

const mockStats: AdminStats = {
  total_transactions: 1234,
  total_import_sessions: 5,
  import_session_status: {
    completed: 4,
    rolled_back: 1
  },
  account_stats: [
    { account: 'Chase Checking', count: 500, total: -1500.50 },
    { account: 'Amex Credit', count: 734, total: -3200.25 }
  ]
}

describe('OverviewTab', () => {
  const defaultProps = {
    stats: mockStats,
    confirmPurgeAll: false,
    actionInProgress: false,
    onPurgeAll: vi.fn(),
    onCancelPurge: vi.fn()
  }

  it('renders stats overview cards', () => {
    render(<OverviewTab {...defaultProps} />)

    expect(screen.getByText('Total Transactions')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('Import Sessions')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Completed Imports')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Rolled Back')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('renders account stats table', () => {
    render(<OverviewTab {...defaultProps} />)

    expect(screen.getByText('Transactions by Account')).toBeInTheDocument()
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Amex Credit')).toBeInTheDocument()
    expect(screen.getByText('734')).toBeInTheDocument()
  })

  it('renders nothing when stats is null', () => {
    render(<OverviewTab {...defaultProps} stats={null} />)

    expect(screen.queryByText('Total Transactions')).not.toBeInTheDocument()
    expect(screen.queryByText('Transactions by Account')).not.toBeInTheDocument()
  })

  it('renders danger zone with purge button', () => {
    render(<OverviewTab {...defaultProps} />)

    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('Purge All Transactions')).toBeInTheDocument()
  })

  it('calls onPurgeAll when purge button clicked', () => {
    const onPurgeAll = vi.fn()
    render(<OverviewTab {...defaultProps} onPurgeAll={onPurgeAll} />)

    fireEvent.click(screen.getByText('Purge All Transactions'))
    expect(onPurgeAll).toHaveBeenCalledTimes(1)
  })

  it('shows confirmation state when confirmPurgeAll is true', () => {
    render(<OverviewTab {...defaultProps} confirmPurgeAll={true} />)

    expect(screen.getByText('Click again to confirm PURGE ALL')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onCancelPurge when cancel clicked', () => {
    const onCancelPurge = vi.fn()
    render(<OverviewTab {...defaultProps} confirmPurgeAll={true} onCancelPurge={onCancelPurge} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancelPurge).toHaveBeenCalledTimes(1)
  })

  it('shows processing state when actionInProgress is true', () => {
    render(<OverviewTab {...defaultProps} actionInProgress={true} />)

    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('disables purge button when action in progress', () => {
    render(<OverviewTab {...defaultProps} actionInProgress={true} />)

    const button = screen.getByText('Processing...')
    expect(button).toBeDisabled()
  })

  it('hides account stats table when empty', () => {
    render(<OverviewTab {...defaultProps} stats={{ ...mockStats, account_stats: [] }} />)

    expect(screen.queryByText('Transactions by Account')).not.toBeInTheDocument()
  })

  it('formats currency correctly for account totals', () => {
    render(<OverviewTab {...defaultProps} />)

    // Check for negative amounts formatted as currency
    expect(screen.getByText('-$1,500.50')).toBeInTheDocument()
    expect(screen.getByText('-$3,200.25')).toBeInTheDocument()
  })
})
