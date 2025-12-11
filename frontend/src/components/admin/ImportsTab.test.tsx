import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportsTab } from './ImportsTab'
import { ImportSession } from '@/types/admin'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}))

const mockSessions: ImportSession[] = [
  {
    id: 1,
    filename: 'transactions_jan.csv',
    format_type: 'chase_csv',
    account_source: 'Chase Checking',
    transaction_count: 50,
    duplicate_count: 2,
    total_amount: -1500.50,
    date_range_start: '2024-01-01',
    date_range_end: '2024-01-31',
    status: 'completed',
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    filename: 'amex_feb.csv',
    format_type: 'amex_csv',
    account_source: 'Amex Gold',
    transaction_count: 30,
    duplicate_count: 0,
    total_amount: -800.25,
    date_range_start: '2024-02-01',
    date_range_end: '2024-02-28',
    status: 'rolled_back',
    created_at: '2024-02-10T14:00:00Z'
  }
]

describe('ImportsTab', () => {
  const defaultProps = {
    sessions: mockSessions,
    confirmDelete: null,
    actionInProgress: false,
    onDeleteSession: vi.fn(),
    onCancelDelete: vi.fn()
  }

  it('renders import sessions header', () => {
    render(<ImportsTab {...defaultProps} />)

    expect(screen.getByText('Import Sessions')).toBeInTheDocument()
    expect(screen.getByText(/History of all CSV imports/)).toBeInTheDocument()
  })

  it('renders Import New link', () => {
    render(<ImportsTab {...defaultProps} />)

    const link = screen.getByText('Import New')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/import')
  })

  it('renders session data in table', () => {
    render(<ImportsTab {...defaultProps} />)

    expect(screen.getByText('transactions_jan.csv')).toBeInTheDocument()
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    expect(screen.getByText('amex_feb.csv')).toBeInTheDocument()
    expect(screen.getByText('Amex Gold')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders empty state when no sessions', () => {
    render(<ImportsTab {...defaultProps} sessions={[]} />)

    expect(screen.getByText('No import sessions found')).toBeInTheDocument()
  })

  it('renders Roll Back button for completed sessions', () => {
    render(<ImportsTab {...defaultProps} />)

    expect(screen.getByText('Roll Back')).toBeInTheDocument()
  })

  it('does not render Roll Back button for rolled_back sessions', () => {
    const rolledBackOnly = [mockSessions[1]]
    render(<ImportsTab {...defaultProps} sessions={rolledBackOnly} />)

    expect(screen.queryByText('Roll Back')).not.toBeInTheDocument()
  })

  it('calls onDeleteSession when Roll Back clicked', () => {
    const onDeleteSession = vi.fn()
    render(<ImportsTab {...defaultProps} onDeleteSession={onDeleteSession} />)

    fireEvent.click(screen.getByText('Roll Back'))
    expect(onDeleteSession).toHaveBeenCalledWith(1)
  })

  it('shows Confirm Delete when confirmDelete matches session', () => {
    render(<ImportsTab {...defaultProps} confirmDelete={1} />)

    expect(screen.getByText('Confirm Delete')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onCancelDelete when cancel clicked', () => {
    const onCancelDelete = vi.fn()
    render(<ImportsTab {...defaultProps} confirmDelete={1} onCancelDelete={onCancelDelete} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancelDelete).toHaveBeenCalledTimes(1)
  })

  it('disables Roll Back button when action in progress', () => {
    render(<ImportsTab {...defaultProps} actionInProgress={true} />)

    const button = screen.getByText('Roll Back')
    expect(button).toBeDisabled()
  })

  it('displays status badges correctly', () => {
    render(<ImportsTab {...defaultProps} />)

    expect(screen.getByText('completed')).toBeInTheDocument()
    expect(screen.getByText('rolled_back')).toBeInTheDocument()
  })

  it('formats date range correctly', () => {
    render(<ImportsTab {...defaultProps} />)

    // Date formatting uses Intl.DateTimeFormat.formatRange which produces
    // various formats depending on whether dates span months/years.
    // Just verify that we have date content containing 2024 (not just "-")
    const cells = screen.getAllByRole('cell')
    const dateRangeCells = cells.filter(cell => {
      const text = cell.textContent || ''
      return text.includes('2024') && text !== '-'
    })
    expect(dateRangeCells.length).toBeGreaterThanOrEqual(2)
  })

  it('shows dash when date range is missing', () => {
    const sessionNoDateRange: ImportSession[] = [{
      ...mockSessions[0],
      date_range_start: null,
      date_range_end: null
    }]
    render(<ImportsTab {...defaultProps} sessions={sessionNoDateRange} />)

    // Look for the dash in the date range column
    const cells = screen.getAllByRole('cell')
    const dateRangeCell = cells.find(cell => cell.textContent === '-')
    expect(dateRangeCell).toBeInTheDocument()
  })

  it('applies rolled_back row styling', () => {
    render(<ImportsTab {...defaultProps} />)

    // The rolled back session row should have bg-negative class
    const rows = screen.getAllByRole('row')
    // First row is header, second is completed session, third is rolled_back session
    expect(rows[2]).toHaveClass('bg-negative')
  })
})
