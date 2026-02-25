import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TEST_IDS } from '@/test-ids'
import { BulkActions } from './BulkActions'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface Transaction {
  id: number
  date: string
  amount: number
  description: string
  merchant: string | null
  account_source: string
  account_tag_id: number | null
  category: string | null
  reconciliation_status: string
}

describe('BulkActions', () => {
  const mockBucketTags: Tag[] = [
    { id: 1, namespace: 'bucket', value: 'groceries' },
    { id: 2, namespace: 'bucket', value: 'dining' },
  ]

  const mockOccasionTags: Tag[] = [
    { id: 3, namespace: 'occasion', value: 'weekly-shopping' },
    { id: 4, namespace: 'occasion', value: 'date-night' },
  ]

  const mockAccountTags: Tag[] = [
    { id: 5, namespace: 'account', value: 'chase-checking', description: 'Chase Checking' },
    { id: 6, namespace: 'account', value: 'amex-gold', description: 'Amex Gold' },
  ]

  const mockTransactions: Transaction[] = [
    {
      id: 1,
      date: '2024-01-15',
      amount: -50,
      description: 'Coffee',
      merchant: 'Starbucks',
      account_source: 'chase-checking',
      account_tag_id: 5,
      category: null,
      reconciliation_status: 'unreconciled',
    },
    {
      id: 2,
      date: '2024-01-14',
      amount: -100,
      description: 'Groceries',
      merchant: 'Whole Foods',
      account_source: 'chase-checking',
      account_tag_id: 5,
      category: null,
      reconciliation_status: 'unreconciled',
    },
  ]

  const defaultProps = {
    selectedIds: new Set<number>(),
    setSelectedIds: vi.fn(),
    transactions: mockTransactions,
    totalCount: 50,
    bucketTags: mockBucketTags,
    occasionTags: mockOccasionTags,
    accountTags: mockAccountTags,
    onBulkApply: vi.fn(),
    bulkAction: '',
    setBulkAction: vi.fn(),
    bulkValue: '',
    setBulkValue: vi.fn(),
    bulkLoading: false,
    onToggleSelectAll: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders select all checkbox', () => {
    render(<BulkActions {...defaultProps} />)
    expect(screen.getByTestId(TEST_IDS.BULK_SELECT_ALL)).toBeInTheDocument()
  })

  it('calls onToggleSelectAll when checkbox clicked', () => {
    const onToggleSelectAll = vi.fn()
    render(<BulkActions {...defaultProps} onToggleSelectAll={onToggleSelectAll} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.BULK_SELECT_ALL))
    expect(onToggleSelectAll).toHaveBeenCalledTimes(1)
  })

  it('shows selected count when items selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} />)

    expect(screen.getByText(/bulk.selected/i)).toBeInTheDocument()
  })

  it('shows select all message when no items selected', () => {
    render(<BulkActions {...defaultProps} />)

    expect(screen.getByText(/bulk.selectAll/i)).toBeInTheDocument()
  })

  it('renders bulk action dropdown when items selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} />)

    expect(screen.getByTestId(TEST_IDS.BULK_ACTION_SELECT)).toBeInTheDocument()
  })

  it('does not render bulk action dropdown when no items selected', () => {
    render(<BulkActions {...defaultProps} />)

    expect(screen.queryByTestId(TEST_IDS.BULK_ACTION_SELECT)).not.toBeInTheDocument()
  })

  it('calls setBulkAction when action selected', () => {
    const setBulkAction = vi.fn()
    const setBulkValue = vi.fn()
    const selectedIds = new Set([1])
    render(<BulkActions
      {...defaultProps}
      selectedIds={selectedIds}
      setBulkAction={setBulkAction}
      setBulkValue={setBulkValue}
    />)

    fireEvent.change(screen.getByTestId(TEST_IDS.BULK_ACTION_SELECT), { target: { value: 'bucket' } })

    expect(setBulkAction).toHaveBeenCalledWith('bucket')
    expect(setBulkValue).toHaveBeenCalledWith('')
  })

  it('renders bucket dropdown when bucket action selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} bulkAction="bucket" />)

    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(1) // Action select + bucket select
  })

  it('renders occasion dropdown when occasion action selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} bulkAction="occasion" />)

    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(1) // Action select + occasion select
  })

  it('renders account dropdown when account action selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} bulkAction="account" />)

    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(1) // Action select + account select
  })

  it('renders apply button when bulkValue is set', () => {
    const selectedIds = new Set([1])
    render(<BulkActions
      {...defaultProps}
      selectedIds={selectedIds}
      bulkAction="bucket"
      bulkValue="bucket:groceries"
    />)

    expect(screen.getByTestId(TEST_IDS.BULK_APPLY_BUTTON)).toBeInTheDocument()
  })

  it('does not render apply button when bulkValue is empty', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} bulkAction="bucket" />)

    expect(screen.queryByTestId(TEST_IDS.BULK_APPLY_BUTTON)).not.toBeInTheDocument()
  })

  it('calls onBulkApply when apply button clicked', () => {
    const onBulkApply = vi.fn()
    const selectedIds = new Set([1])
    render(<BulkActions
      {...defaultProps}
      selectedIds={selectedIds}
      bulkAction="bucket"
      bulkValue="bucket:groceries"
      onBulkApply={onBulkApply}
    />)

    fireEvent.click(screen.getByTestId(TEST_IDS.BULK_APPLY_BUTTON))
    expect(onBulkApply).toHaveBeenCalledTimes(1)
  })

  it('disables apply button when bulkLoading=true', () => {
    const selectedIds = new Set([1])
    render(<BulkActions
      {...defaultProps}
      selectedIds={selectedIds}
      bulkAction="bucket"
      bulkValue="bucket:groceries"
      bulkLoading={true}
    />)

    expect(screen.getByTestId(TEST_IDS.BULK_APPLY_BUTTON)).toBeDisabled()
  })

  it('shows loading state when bulkLoading=true', () => {
    const selectedIds = new Set([1])
    render(<BulkActions
      {...defaultProps}
      selectedIds={selectedIds}
      bulkAction="bucket"
      bulkValue="bucket:groceries"
      bulkLoading={true}
    />)

    expect(screen.getByText(/bulk.applying/i)).toBeInTheDocument()
  })

  it('renders clear selection button when items selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} />)

    expect(screen.getByText(/bulk.clearSelection/i)).toBeInTheDocument()
  })

  it('clears selection when clear button clicked', () => {
    const setSelectedIds = vi.fn()
    const setBulkAction = vi.fn()
    const setBulkValue = vi.fn()
    const selectedIds = new Set([1])
    render(<BulkActions
      {...defaultProps}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      setBulkAction={setBulkAction}
      setBulkValue={setBulkValue}
    />)

    fireEvent.click(screen.getByText(/bulk.clearSelection/i))

    expect(setSelectedIds).toHaveBeenCalledWith(new Set())
    expect(setBulkAction).toHaveBeenCalledWith('')
    expect(setBulkValue).toHaveBeenCalledWith('')
  })

  it('checks select all checkbox when all transactions selected', () => {
    const selectedIds = new Set([1, 2])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} />)

    const checkbox = screen.getByTestId(TEST_IDS.BULK_SELECT_ALL) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('unchecks select all checkbox when no transactions selected', () => {
    render(<BulkActions {...defaultProps} />)

    const checkbox = screen.getByTestId(TEST_IDS.BULK_SELECT_ALL) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('sets indeterminate state when some transactions selected', () => {
    const selectedIds = new Set([1])
    render(<BulkActions {...defaultProps} selectedIds={selectedIds} />)

    const checkbox = screen.getByTestId(TEST_IDS.BULK_SELECT_ALL) as HTMLInputElement
    expect(checkbox.indeterminate).toBe(true)
  })
})
