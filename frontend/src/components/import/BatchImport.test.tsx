import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BatchImport } from './BatchImport'
import { FilePreview, AccountTag } from '@/types/import'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock useFormat hook
vi.mock('@/hooks/useFormat', () => ({
  useFormat: () => ({
    formatCurrency: (value: number) => `$${value}`,
    formatDateRange: (start: string, end: string) => `${start} - ${end}`,
  }),
}))

describe('BatchImport', () => {
  const mockAccounts: AccountTag[] = [
    { id: 1, namespace: 'account', value: 'Chase Checking' },
    { id: 2, namespace: 'account', value: 'Amex Gold' },
  ]

  const mockFiles: File[] = [
    new File(['test1'], 'file1.csv', { type: 'text/csv' }),
    new File(['test2'], 'file2.csv', { type: 'text/csv' }),
  ]

  const mockBatchPreviews: FilePreview[] = [
    {
      filename: 'file1.csv',
      detected_format: 'chase_csv',
      transaction_count: 50,
      duplicate_count: 5,
      cross_file_duplicate_count: 2,
      total_amount: -1500.5,
      date_range_start: '2024-01-01',
      date_range_end: '2024-01-31',
      account_source: 'Chase Checking',
      accountSourceOverride: null,
      selected: true,
    },
    {
      filename: 'file2.csv',
      detected_format: 'amex_csv',
      transaction_count: 30,
      duplicate_count: 3,
      cross_file_duplicate_count: 1,
      total_amount: -800.25,
      date_range_start: '2024-01-01',
      date_range_end: '2024-01-31',
      account_source: 'Amex Gold',
      accountSourceOverride: null,
      selected: true,
    },
  ]

  const defaultProps = {
    files: mockFiles,
    setFiles: vi.fn(),
    batchPreviews: [],
    accounts: mockAccounts,
    importing: false,
    onPreview: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    onToggleSelection: vi.fn(),
    onUpdateAccountSource: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders file input', () => {
    render(<BatchImport {...defaultProps} />)

    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('multiple')
  })

  it('shows files selected count', () => {
    render(<BatchImport {...defaultProps} />)

    expect(screen.getByText(/filesSelected/i)).toBeInTheDocument()
  })

  it('calls setFiles when files selected', () => {
    const setFiles = vi.fn()
    render(<BatchImport {...defaultProps} setFiles={setFiles} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const fileList = [new File(['test'], 'test.csv', { type: 'text/csv' })]
    Object.defineProperty(input, 'files', {
      value: fileList,
      writable: false,
    })

    fireEvent.change(input)

    expect(setFiles).toHaveBeenCalled()
  })

  it('renders preview button', () => {
    render(<BatchImport {...defaultProps} />)

    expect(screen.getByText(/previewBatchImport/i)).toBeInTheDocument()
  })

  it('disables preview button when no files', () => {
    render(<BatchImport {...defaultProps} files={[]} />)

    const button = screen.getByText(/previewBatchImport/i)
    expect(button).toBeDisabled()
  })

  it('calls onPreview when preview button clicked', () => {
    const onPreview = vi.fn()
    render(<BatchImport {...defaultProps} onPreview={onPreview} />)

    fireEvent.click(screen.getByText(/previewBatchImport/i))
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  describe('with batch previews', () => {
    const previewProps = {
      ...defaultProps,
      batchPreviews: mockBatchPreviews,
    }

    it('renders batch preview title', () => {
      render(<BatchImport {...previewProps} />)

      expect(screen.getByText(/batchImportPreview/i)).toBeInTheDocument()
    })

    it('renders summary stats', () => {
      render(<BatchImport {...previewProps} />)

      expect(screen.getByText(/totalTransactions/i)).toBeInTheDocument()
      expect(screen.getByText(/totalDuplicates/i)).toBeInTheDocument()
      expect(screen.getByText(/netAmount/i)).toBeInTheDocument()
    })

    it('calculates correct total transactions', () => {
      render(<BatchImport {...previewProps} />)

      const summarySection = screen.getByText(/totalTransactions/i).parentElement
      expect(summarySection).toHaveTextContent('80')
    })

    it('calculates correct total duplicates', () => {
      render(<BatchImport {...previewProps} />)

      const summarySection = screen.getByText(/totalDuplicates/i).parentElement
      expect(summarySection).toHaveTextContent('11')
    })

    it('renders file list', () => {
      render(<BatchImport {...previewProps} />)

      expect(screen.getByText('file1.csv')).toBeInTheDocument()
      expect(screen.getByText('file2.csv')).toBeInTheDocument()
    })

    it('renders checkbox for each file', () => {
      render(<BatchImport {...previewProps} />)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThanOrEqual(2)
    })

    it('calls onToggleSelection when checkbox clicked', () => {
      const onToggleSelection = vi.fn()
      render(<BatchImport {...previewProps} onToggleSelection={onToggleSelection} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      expect(onToggleSelection).toHaveBeenCalledWith('file1.csv')
    })

    it('renders account source input for each file', () => {
      render(<BatchImport {...previewProps} />)

      const selects = screen.getAllByRole('combobox')
      expect(selects.length).toBeGreaterThanOrEqual(2)
    })

    it('calls onUpdateAccountSource when account changed', () => {
      const onUpdateAccountSource = vi.fn()
      render(<BatchImport {...previewProps} onUpdateAccountSource={onUpdateAccountSource} />)

      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[0], { target: { value: 'Amex Gold' } })

      expect(onUpdateAccountSource).toHaveBeenCalledWith('file1.csv', 'Amex Gold')
    })

    it('renders confirm button', () => {
      render(<BatchImport {...previewProps} />)

      expect(screen.getByText(/importSelectedFiles/i)).toBeInTheDocument()
    })

    it('renders cancel button', () => {
      render(<BatchImport {...previewProps} />)

      expect(screen.getByText(/cancel/i)).toBeInTheDocument()
    })

    it('calls onConfirm when confirm button clicked', () => {
      const onConfirm = vi.fn()
      render(<BatchImport {...previewProps} onConfirm={onConfirm} />)

      fireEvent.click(screen.getByText(/importSelectedFiles/i))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onCancel when cancel button clicked', () => {
      const onCancel = vi.fn()
      render(<BatchImport {...previewProps} onCancel={onCancel} />)

      fireEvent.click(screen.getByText(/cancel/i))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('disables confirm button when importing', () => {
      render(<BatchImport {...previewProps} importing={true} />)

      const button = screen.getByText(/importing/i)
      expect(button).toBeDisabled()
    })

    it('disables confirm button when no files selected', () => {
      const noneSelectedPreviews = mockBatchPreviews.map((p) => ({ ...p, selected: false }))
      render(<BatchImport {...previewProps} batchPreviews={noneSelectedPreviews} />)

      const button = screen.getByText(/importSelectedFiles/i)
      expect(button).toBeDisabled()
    })

    it('disables confirm button when files missing accounts', () => {
      const noAccountPreviews = mockBatchPreviews.map((p) => ({
        ...p,
        account_source: '',
        accountSourceOverride: null,
      }))
      render(<BatchImport {...previewProps} batchPreviews={noAccountPreviews} />)

      const button = screen.getByText(/filesMissingAccount/i)
      expect(button).toBeDisabled()
    })

    it('renders file details including transactions and duplicates', () => {
      const { container } = render(<BatchImport {...previewProps} />)

      // Just verify the data is rendered somewhere in the component
      expect(container).toHaveTextContent('file1.csv')
      expect(container).toHaveTextContent('file2.csv')
      expect(container).toHaveTextContent('50')
      expect(container).toHaveTextContent('30')
      expect(container).toHaveTextContent('$-1500.5')
      expect(container).toHaveTextContent('$-800.25')
    })
  })
})
