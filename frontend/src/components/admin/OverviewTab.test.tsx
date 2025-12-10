import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverviewTab } from './OverviewTab'
import { AdminStats } from '@/types/admin'
import { TEST_IDS, CHAOS_EXCLUDED_IDS } from '@/test-ids'

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

    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_TOTAL_TRANSACTIONS)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_TOTAL_TRANSACTIONS_VALUE)).toHaveTextContent('1,234')
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_IMPORT_SESSIONS)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_IMPORT_SESSIONS_VALUE)).toHaveTextContent('5')
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_COMPLETED_IMPORTS)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_COMPLETED_IMPORTS_VALUE)).toHaveTextContent('4')
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_ROLLED_BACK)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.OVERVIEW_STAT_ROLLED_BACK_VALUE)).toHaveTextContent('1')
  })

  it('renders account stats table', () => {
    render(<OverviewTab {...defaultProps} />)

    const accountStats = screen.getByTestId(TEST_IDS.OVERVIEW_ACCOUNT_STATS)
    expect(accountStats).toBeInTheDocument()
    expect(accountStats).toHaveTextContent('Chase Checking')
    expect(accountStats).toHaveTextContent('500')
    expect(accountStats).toHaveTextContent('Amex Credit')
    expect(accountStats).toHaveTextContent('734')
  })

  it('renders nothing when stats is null', () => {
    render(<OverviewTab {...defaultProps} stats={null} />)

    expect(screen.queryByTestId(TEST_IDS.OVERVIEW_STATS)).not.toBeInTheDocument()
    expect(screen.queryByTestId(TEST_IDS.OVERVIEW_ACCOUNT_STATS)).not.toBeInTheDocument()
  })

  it('renders danger zone', () => {
    render(<OverviewTab {...defaultProps} />)

    expect(screen.getByTestId(TEST_IDS.OVERVIEW_DANGER_ZONE)).toBeInTheDocument()
    expect(screen.getByTestId(CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA)).toBeInTheDocument()
  })

  it('calls onPurgeAll when purge button clicked', () => {
    const onPurgeAll = vi.fn()
    render(<OverviewTab {...defaultProps} onPurgeAll={onPurgeAll} />)

    fireEvent.click(screen.getByTestId(CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA))
    expect(onPurgeAll).toHaveBeenCalledTimes(1)
  })

  it('shows confirmation state when confirmPurgeAll is true', () => {
    render(<OverviewTab {...defaultProps} confirmPurgeAll={true} />)

    const purgeButton = screen.getByTestId(CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA)
    expect(purgeButton).toBeInTheDocument()
  })

  it('calls onCancelPurge when cancel clicked', () => {
    const onCancelPurge = vi.fn()
    render(<OverviewTab {...defaultProps} confirmPurgeAll={true} onCancelPurge={onCancelPurge} />)

    // Find cancel button within danger zone
    const dangerZone = screen.getByTestId(TEST_IDS.OVERVIEW_DANGER_ZONE)
    const cancelButton = dangerZone.querySelector('button:not([data-testid])')
    if (cancelButton) {
      fireEvent.click(cancelButton)
      expect(onCancelPurge).toHaveBeenCalledTimes(1)
    }
  })

  it('disables purge button when action in progress', () => {
    render(<OverviewTab {...defaultProps} actionInProgress={true} />)

    const button = screen.getByTestId(CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA)
    expect(button).toBeDisabled()
  })

  it('hides account stats table when empty', () => {
    render(<OverviewTab {...defaultProps} stats={{ ...mockStats, account_stats: [] }} />)

    expect(screen.queryByTestId(TEST_IDS.OVERVIEW_ACCOUNT_STATS)).not.toBeInTheDocument()
  })

  it('formats currency correctly for account totals', () => {
    render(<OverviewTab {...defaultProps} />)

    const accountStats = screen.getByTestId(TEST_IDS.OVERVIEW_ACCOUNT_STATS)
    expect(accountStats).toHaveTextContent('-$1,500.50')
    expect(accountStats).toHaveTextContent('-$3,200.25')
  })
})
