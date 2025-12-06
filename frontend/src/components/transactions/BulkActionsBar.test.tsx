import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkActionsBar from './BulkActionsBar'
import { Transaction, Tag } from '@/types/transactions'

const mockTransactions: Transaction[] = [
  { id: 1, date: '2024-12-01', amount: -50, description: 'Test 1', merchant: 'Store', account_source: 'checking', account_tag_id: null, category: null, reconciliation_status: 'unreconciled' },
  { id: 2, date: '2024-12-02', amount: -75, description: 'Test 2', merchant: 'Shop', account_source: 'checking', account_tag_id: null, category: null, reconciliation_status: 'unreconciled' },
]

const mockBucketTags: Tag[] = [
  { id: 1, namespace: 'bucket', value: 'groceries', description: 'Food shopping' },
  { id: 2, namespace: 'bucket', value: 'dining', description: 'Restaurants' },
]

const mockOccasionTags: Tag[] = [
  { id: 3, namespace: 'occasion', value: 'vacation-2024', description: 'Summer vacation' },
]

const mockAccountTags: Tag[] = [
  { id: 4, namespace: 'account', value: 'checking', description: 'Main Checking' },
]

describe('BulkActionsBar', () => {
  const defaultProps = {
    selectedIds: new Set<number>(),
    transactions: mockTransactions,
    totalCount: 100,
    bucketTags: mockBucketTags,
    occasionTags: mockOccasionTags,
    accountTags: mockAccountTags,
    onToggleAll: vi.fn(),
    onClearSelection: vi.fn(),
    onApplyTag: vi.fn().mockResolvedValue(undefined),
  }

  it('renders with no selection', () => {
    render(<BulkActionsBar {...defaultProps} />)
    expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument()
    expect(screen.getByText('Select all (2 loaded)')).toBeInTheDocument()
  })

  it('shows selection count when items selected', () => {
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1, 2])} />)
    expect(screen.getByText('2 of 100 selected')).toBeInTheDocument()
  })

  it('shows clear selection button when items selected', () => {
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} />)
    expect(screen.getByTestId('clear-selection-btn')).toBeInTheDocument()
  })

  it('calls onClearSelection when clear button clicked', async () => {
    const user = userEvent.setup()
    const onClearSelection = vi.fn()
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} onClearSelection={onClearSelection} />)

    await user.click(screen.getByTestId('clear-selection-btn'))
    expect(onClearSelection).toHaveBeenCalled()
  })

  it('calls onToggleAll when select all checkbox clicked', async () => {
    const user = userEvent.setup()
    const onToggleAll = vi.fn()
    render(<BulkActionsBar {...defaultProps} onToggleAll={onToggleAll} />)

    await user.click(screen.getByTestId('select-all-checkbox'))
    expect(onToggleAll).toHaveBeenCalled()
  })

  it('shows bulk action type dropdown when items selected', () => {
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} />)
    expect(screen.getByTestId('bulk-action-type')).toBeInTheDocument()
  })

  it('shows bucket dropdown when bucket action selected', async () => {
    const user = userEvent.setup()
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} />)

    await user.selectOptions(screen.getByTestId('bulk-action-type'), 'bucket')
    expect(screen.getByTestId('bulk-bucket-select')).toBeInTheDocument()
  })

  it('shows occasion dropdown when occasion action selected', async () => {
    const user = userEvent.setup()
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} />)

    await user.selectOptions(screen.getByTestId('bulk-action-type'), 'occasion')
    expect(screen.getByTestId('bulk-occasion-select')).toBeInTheDocument()
  })

  it('shows account dropdown when account action selected', async () => {
    const user = userEvent.setup()
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} />)

    await user.selectOptions(screen.getByTestId('bulk-action-type'), 'account')
    expect(screen.getByTestId('bulk-account-select')).toBeInTheDocument()
  })

  it('shows apply button when action and value selected', async () => {
    const user = userEvent.setup()
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1])} />)

    await user.selectOptions(screen.getByTestId('bulk-action-type'), 'bucket')
    await user.selectOptions(screen.getByTestId('bulk-bucket-select'), 'bucket:groceries')

    expect(screen.getByTestId('bulk-apply-btn')).toBeInTheDocument()
    expect(screen.getByText('Apply to 1')).toBeInTheDocument()
  })

  it('calls onApplyTag when apply button clicked', async () => {
    const user = userEvent.setup()
    const onApplyTag = vi.fn().mockResolvedValue(undefined)
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1, 2])} onApplyTag={onApplyTag} />)

    await user.selectOptions(screen.getByTestId('bulk-action-type'), 'bucket')
    await user.selectOptions(screen.getByTestId('bulk-bucket-select'), 'bucket:groceries')
    await user.click(screen.getByTestId('bulk-apply-btn'))

    await waitFor(() => {
      expect(onApplyTag).toHaveBeenCalledWith('bucket:groceries', [1, 2])
    })
  })

  it('checkbox is checked when all transactions selected', () => {
    render(<BulkActionsBar {...defaultProps} selectedIds={new Set([1, 2])} />)
    const checkbox = screen.getByTestId('select-all-checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })
})
