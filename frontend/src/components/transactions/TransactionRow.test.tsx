import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionRow from './TransactionRow'
import { Transaction, Tag, TransactionTag } from '@/types/transactions'

const mockBucketTags: Tag[] = [
  { id: 1, namespace: 'bucket', value: 'groceries' },
  { id: 2, namespace: 'bucket', value: 'dining' },
]

const mockAccountTags: Tag[] = [
  { id: 3, namespace: 'account', value: 'checking', description: 'Main Checking' },
]

const mockAllTags: Tag[] = [
  ...mockBucketTags,
  ...mockAccountTags,
  { id: 4, namespace: 'occasion', value: 'vacation-2024', description: 'Summer Vacation' },
]

const mockTransaction: Transaction = {
  id: 1,
  date: '2024-12-01',
  amount: -50.25,
  description: 'GROCERY STORE #1234',
  merchant: 'Grocery Store',
  account_source: 'checking',
  account_tag_id: 3,
  category: null,
  reconciliation_status: 'unreconciled',
  tags: [{ namespace: 'bucket', value: 'groceries', full: 'bucket:groceries' }],
  bucket: 'groceries',
  account: 'checking',
}

describe('TransactionRow', () => {
  const defaultProps = {
    transaction: mockTransaction,
    isSelected: false,
    isExpanded: false,
    bucketTags: mockBucketTags,
    accountTags: mockAccountTags,
    allTags: mockAllTags,
    onToggleSelect: vi.fn(),
    onToggleExpand: vi.fn(),
    onBucketChange: vi.fn(),
    onAccountChange: vi.fn(),
    onRemoveTag: vi.fn(),
    onAddTag: vi.fn(),
    onToggleTransfer: vi.fn(),
    onUnlinkTransfer: vi.fn(),
    onSaveNote: vi.fn(),
    onTransactionsChanged: vi.fn(),
  }

  it('renders transaction row', () => {
    render(<TransactionRow {...defaultProps} />)
    expect(screen.getByTestId('transaction-row-1')).toBeInTheDocument()
  })

  it('displays merchant name', () => {
    render(<TransactionRow {...defaultProps} />)
    expect(screen.getByText('Grocery Store')).toBeInTheDocument()
  })

  it('displays formatted amount', () => {
    render(<TransactionRow {...defaultProps} />)
    expect(screen.getByText('-$50.25')).toBeInTheDocument()
  })

  it('displays formatted date', () => {
    render(<TransactionRow {...defaultProps} />)
    expect(screen.getByText('12/01/2024')).toBeInTheDocument()
  })

  it('shows selected styling when selected', () => {
    render(<TransactionRow {...defaultProps} isSelected={true} />)
    const row = screen.getByTestId('transaction-row-1')
    expect(row.className).toContain('bg-[var(--color-accent)]/10')
  })

  it('checkbox is checked when selected', () => {
    render(<TransactionRow {...defaultProps} isSelected={true} />)
    const checkbox = screen.getByTestId('txn-checkbox-1') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('calls onToggleSelect when checkbox clicked', async () => {
    const user = userEvent.setup()
    const onToggleSelect = vi.fn()
    render(<TransactionRow {...defaultProps} onToggleSelect={onToggleSelect} />)

    await user.click(screen.getByTestId('txn-checkbox-1'))
    expect(onToggleSelect).toHaveBeenCalled()
  })

  it('calls onToggleExpand when expand button clicked', async () => {
    const user = userEvent.setup()
    const onToggleExpand = vi.fn()
    render(<TransactionRow {...defaultProps} onToggleExpand={onToggleExpand} />)

    await user.click(screen.getByTestId('txn-expand-1'))
    expect(onToggleExpand).toHaveBeenCalled()
  })

  it('shows expanded section when isExpanded', () => {
    render(<TransactionRow {...defaultProps} isExpanded={true} />)
    expect(screen.getByTestId('txn-expanded-1')).toBeInTheDocument()
    expect(screen.getByText('unreconciled')).toBeInTheDocument()
  })

  it('displays bucket dropdown with correct value', () => {
    render(<TransactionRow {...defaultProps} />)
    const select = screen.getByTestId('txn-bucket-1') as HTMLSelectElement
    expect(select.value).toBe('groceries')
  })

  it('calls onBucketChange when bucket changed', async () => {
    const user = userEvent.setup()
    const onBucketChange = vi.fn()
    render(<TransactionRow {...defaultProps} onBucketChange={onBucketChange} />)

    await user.selectOptions(screen.getByTestId('txn-bucket-1'), 'dining')
    expect(onBucketChange).toHaveBeenCalledWith(1, 'dining')
  })

  it('displays account dropdown with correct value', () => {
    render(<TransactionRow {...defaultProps} />)
    const select = screen.getByTestId('txn-account-1') as HTMLSelectElement
    expect(select.value).toBe('checking')
  })

  it('calls onAccountChange when account changed', async () => {
    const user = userEvent.setup()
    const onAccountChange = vi.fn()
    render(<TransactionRow {...defaultProps} onAccountChange={onAccountChange} />)

    const select = screen.getByTestId('txn-account-1')
    await user.selectOptions(select, '')
    expect(onAccountChange).toHaveBeenCalledWith(1, '')
  })

  it('shows transfer badge when is_transfer is true', () => {
    const transferTxn = { ...mockTransaction, is_transfer: true }
    render(<TransactionRow {...defaultProps} transaction={transferTxn} />)
    expect(screen.getByText('Transfer')).toBeInTheDocument()
  })

  it('shows add tag button', () => {
    render(<TransactionRow {...defaultProps} />)
    expect(screen.getByTestId('txn-add-tag-btn-1')).toBeInTheDocument()
  })

  it('shows tag selector when add tag clicked', async () => {
    const user = userEvent.setup()
    render(<TransactionRow {...defaultProps} />)

    await user.click(screen.getByTestId('txn-add-tag-btn-1'))
    expect(screen.getByTestId('txn-add-tag-select-1')).toBeInTheDocument()
  })

  it('shows expanded transfer toggle', () => {
    render(<TransactionRow {...defaultProps} isExpanded={true} />)
    expect(screen.getByTestId('txn-toggle-transfer-1')).toBeInTheDocument()
  })

  it('calls onToggleTransfer when transfer button clicked', async () => {
    const user = userEvent.setup()
    const onToggleTransfer = vi.fn()
    render(<TransactionRow {...defaultProps} isExpanded={true} onToggleTransfer={onToggleTransfer} />)

    await user.click(screen.getByTestId('txn-toggle-transfer-1'))
    expect(onToggleTransfer).toHaveBeenCalledWith(1, false)
  })

  it('shows edit note button in expanded view', () => {
    render(<TransactionRow {...defaultProps} isExpanded={true} />)
    expect(screen.getByTestId('txn-edit-note-1')).toBeInTheDocument()
  })

  it('shows unlink button when linked_transaction_id present', () => {
    const linkedTxn = { ...mockTransaction, linked_transaction_id: 2 }
    render(<TransactionRow {...defaultProps} transaction={linkedTxn} isExpanded={true} />)
    expect(screen.getByTestId('txn-unlink-1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })

  it('displays positive amount in green', () => {
    const positiveTxn = { ...mockTransaction, amount: 100 }
    render(<TransactionRow {...defaultProps} transaction={positiveTxn} />)
    expect(screen.getByText('+$100.00')).toBeInTheDocument()
    const amountElement = screen.getByText('+$100.00')
    expect(amountElement.className).toContain('text-positive')
  })
})
