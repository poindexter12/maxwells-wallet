import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CustomFormatMapper } from './CustomFormatMapper'

// Mock the useFormatDetection hook
const mockRunPreview = vi.fn()
const mockCreateAccountTag = vi.fn()
const mockSetDateColumn = vi.fn()
const mockSetAmountColumn = vi.fn()
const mockSetDescriptionColumn = vi.fn()
const mockSetReferenceColumn = vi.fn()
const mockSetCategoryColumn = vi.fn()
const mockSetDateFormat = vi.fn()
const mockSetAmountConvention = vi.fn()
const mockSetInvertSign = vi.fn()
const mockSetSkipRows = vi.fn()
const mockSetSkipFooterRows = vi.fn()
const mockSetShowPreview = vi.fn()
const mockSetAmountPrefix = vi.fn()

const defaultHookReturn = {
  loading: false,
  error: null,
  analysis: {
    headers: ['Date', 'Amount', 'Description', 'Reference'],
    sample_rows: [['2024-01-01', '100.00', 'Test Transaction', 'REF123']],
    column_hints: {
      Date: { detected_type: 'date', confidence: 0.95 },
      Amount: { detected_type: 'amount', confidence: 0.9 },
      Description: { detected_type: 'description', confidence: 0.85 }
    }
  },
  suggested: {
    date_column: 'Date',
    amount_column: 'Amount',
    description_column: 'Description',
    date_format: '%m/%d/%Y',
    amount_sign_convention: 'negative_prefix',
    _completeness: 1.0
  },
  skipRows: 0,
  setSkipRows: mockSetSkipRows,
  previewTransactions: [],
  previewErrors: [],
  showPreview: false,
  setShowPreview: mockSetShowPreview,
  accountTags: [
    { id: 1, namespace: 'account', value: 'chase-checking', description: 'Chase Checking' },
    { id: 2, namespace: 'account', value: 'amex-gold', description: 'Amex Gold' }
  ],
  runPreview: mockRunPreview,
  createAccountTag: mockCreateAccountTag,
  detectionComplete: true,
  dateColumn: 'Date',
  setDateColumn: mockSetDateColumn,
  amountColumn: 'Amount',
  setAmountColumn: mockSetAmountColumn,
  descriptionColumn: 'Description',
  setDescriptionColumn: mockSetDescriptionColumn,
  referenceColumn: '',
  setReferenceColumn: mockSetReferenceColumn,
  categoryColumn: '',
  setCategoryColumn: mockSetCategoryColumn,
  dateFormat: '%m/%d/%Y',
  setDateFormat: mockSetDateFormat,
  amountConvention: 'negative_prefix',
  setAmountConvention: mockSetAmountConvention,
  amountPrefix: '',
  setAmountPrefix: mockSetAmountPrefix,
  invertSign: false,
  setInvertSign: mockSetInvertSign,
  skipFooterRows: 0,
  setSkipFooterRows: mockSetSkipFooterRows
}

let mockHookReturn = { ...defaultHookReturn }

vi.mock('@/hooks/useFormatDetection', () => ({
  useFormatDetection: () => mockHookReturn
}))

// Mock child components
vi.mock('./format-mapper/ConfidenceDisplay', () => ({
  ConfidenceIcon: ({ confidence }: { confidence: number }) => (
    <span data-testid="confidence-icon">{Math.round(confidence * 100)}%</span>
  ),
  ColumnConfidenceRow: ({ label, column, isSet }: { label: string; column: string; isSet: boolean }) => (
    <div data-testid={`column-row-${label.toLowerCase()}`}>
      {label}: {column} {isSet ? '✓' : '✗'}
    </div>
  )
}))

vi.mock('./format-mapper/PreviewTable', () => ({
  PreviewTable: ({ transactions, onHide }: { transactions: any[]; onHide: () => void }) => (
    <div data-testid="preview-table">
      <span>{transactions.length} transactions</span>
      <button onClick={onHide}>Hide Preview</button>
    </div>
  )
}))

describe('CustomFormatMapper', () => {
  const mockFile = new File(['test'], 'test.csv', { type: 'text/csv' })
  const mockOnConfigured = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    file: mockFile,
    onConfigured: mockOnConfigured,
    onCancel: mockOnCancel
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockHookReturn = { ...defaultHookReturn }
  })

  it('renders loading state', () => {
    mockHookReturn = { ...defaultHookReturn, loading: true, analysis: null }
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByText(/Analyzing test.csv/)).toBeInTheDocument()
  })

  it('renders error message', () => {
    mockHookReturn = { ...defaultHookReturn, error: 'Failed to parse file' }
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByText('Failed to parse file')).toBeInTheDocument()
  })

  it('renders detection status when complete', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByText('Format Auto-Detected')).toBeInTheDocument()
  })

  it('renders partial detection status', () => {
    mockHookReturn = { ...defaultHookReturn, detectionComplete: false }
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByText('Partial Detection')).toBeInTheDocument()
  })

  it('renders configuration section', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    // Configuration heading is present
    const configHeading = screen.getByRole('heading', { level: 3, name: 'Configuration' })
    expect(configHeading).toBeInTheDocument()
    expect(screen.getByText('Format Name')).toBeInTheDocument()
  })

  it('renders account dropdown with options', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByText('-- Select Account --')).toBeInTheDocument()
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Amex Gold')).toBeInTheDocument()
  })

  it('shows new account form when + New clicked', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    // The button text might be rendered with whitespace
    const newButton = screen.getByRole('button', { name: /\+ New/ })
    fireEvent.click(newButton)

    expect(screen.getByPlaceholderText('New account name')).toBeInTheDocument()
    expect(screen.getByText('Add')).toBeInTheDocument()
  })

  it('calls createAccountTag when adding new account', async () => {
    mockCreateAccountTag.mockResolvedValue('new-account')
    render(<CustomFormatMapper {...defaultProps} />)

    fireEvent.click(screen.getByText('+ New'))
    fireEvent.change(screen.getByPlaceholderText('New account name'), {
      target: { value: 'New Account' }
    })
    fireEvent.click(screen.getByText('Add'))

    await waitFor(() => {
      expect(mockCreateAccountTag).toHaveBeenCalledWith('New Account')
    })
  })

  it('hides new account form on cancel', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    fireEvent.click(screen.getByText('+ New'))
    expect(screen.getByPlaceholderText('New account name')).toBeInTheDocument()

    // Find the Cancel button in the new account form (not the main cancel)
    const cancelButtons = screen.getAllByText('Cancel')
    fireEvent.click(cancelButtons[0])

    expect(screen.queryByPlaceholderText('New account name')).not.toBeInTheDocument()
  })

  it('renders column confidence rows', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByTestId('column-row-date')).toBeInTheDocument()
    expect(screen.getByTestId('column-row-amount')).toBeInTheDocument()
    expect(screen.getByTestId('column-row-description')).toBeInTheDocument()
  })

  it('toggles advanced settings', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.queryByText('Advanced Settings')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Edit Details'))

    expect(screen.getByText('Advanced Settings')).toBeInTheDocument()
    expect(screen.getByText('Date Column *')).toBeInTheDocument()
    expect(screen.getByText('Amount Column *')).toBeInTheDocument()
    expect(screen.getByText('Description Column *')).toBeInTheDocument()
  })

  it('renders optional column selectors in advanced mode', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    fireEvent.click(screen.getByText('Edit Details'))

    expect(screen.getByText('Reference Column')).toBeInTheDocument()
    expect(screen.getByText('Category Column')).toBeInTheDocument()
    expect(screen.getByText('Skip Header Rows')).toBeInTheDocument()
  })

  it('renders format options in advanced mode', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    fireEvent.click(screen.getByText('Edit Details'))

    expect(screen.getByText('Date Format')).toBeInTheDocument()
    expect(screen.getByText('Amount Format')).toBeInTheDocument()
    expect(screen.getByText('Invert sign')).toBeInTheDocument()
  })

  it('calls onCancel when cancel button clicked', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    // The main Cancel button is at the bottom
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButton)

    expect(mockOnCancel).toHaveBeenCalledTimes(1)
  })

  it('calls runPreview when preview button clicked', async () => {
    render(<CustomFormatMapper {...defaultProps} />)

    // Select an account first
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    fireEvent.click(screen.getByText('Preview'))

    expect(mockRunPreview).toHaveBeenCalled()
  })

  it('disables preview button when not ready', () => {
    mockHookReturn = { ...defaultHookReturn, dateColumn: '' }
    render(<CustomFormatMapper {...defaultProps} />)

    const previewButton = screen.getByText('Preview')
    expect(previewButton).toBeDisabled()
  })

  it('disables save button when no preview transactions', () => {
    render(<CustomFormatMapper {...defaultProps} />)

    const saveButton = screen.getByText('Save Format')
    expect(saveButton).toBeDisabled()
  })

  it('enables save button when preview has transactions', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    // Select an account
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    const saveButton = screen.getByText('Save Format')
    expect(saveButton).not.toBeDisabled()
  })

  it('calls onConfigured with config when save clicked', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    // Select an account
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    fireEvent.click(screen.getByText('Save Format'))

    expect(mockOnConfigured).toHaveBeenCalledWith(
      expect.objectContaining({
        account_source: 'chase-checking',
        date_column: 'Date',
        amount_column: 'Amount',
        description_column: 'Description'
      })
    )
  })

  it('renders preview table when showPreview is true', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      showPreview: true,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.getByTestId('preview-table')).toBeInTheDocument()
    expect(screen.getByText('1 transactions')).toBeInTheDocument()
  })

  it('hides preview button when preview is showing', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      showPreview: true,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    expect(screen.queryByRole('button', { name: 'Preview' })).not.toBeInTheDocument()
  })

  it('uses file name as default format name', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    // Select an account
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    fireEvent.click(screen.getByText('Save Format'))

    expect(mockOnConfigured).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test.csv Format'
      })
    )
  })

  it('uses custom format name when provided', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    // Set custom name
    const nameInput = screen.getByPlaceholderText('test.csv Format')
    fireEvent.change(nameInput, { target: { value: 'My Custom Format' } })

    // Select an account
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    fireEvent.click(screen.getByText('Save Format'))

    expect(mockOnConfigured).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Custom Format'
      })
    )
  })

  it('includes description in config', () => {
    mockHookReturn = {
      ...defaultHookReturn,
      previewTransactions: [{ date: '2024-01-01', amount: -100, merchant: 'Test', bucket: null }]
    }
    render(<CustomFormatMapper {...defaultProps} />)

    // Set description
    const descInput = screen.getByPlaceholderText('e.g., Monthly statement export from Chase')
    fireEvent.change(descInput, { target: { value: 'Test description' } })

    // Select an account
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    fireEvent.click(screen.getByText('Save Format'))

    expect(mockOnConfigured).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Test description'
      })
    )
  })

  it('shows loading state in preview button', () => {
    mockHookReturn = { ...defaultHookReturn, loading: true }
    render(<CustomFormatMapper {...defaultProps} />)

    // Select an account first
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'chase-checking' }
    })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('applies initial config when provided', () => {
    render(
      <CustomFormatMapper
        {...defaultProps}
        initialConfig={{
          name: 'Initial Name',
          account_source: 'chase-checking',
          description: 'Initial description'
        }}
      />
    )

    expect(screen.getByDisplayValue('Initial Name')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Initial description')).toBeInTheDocument()
  })
})
