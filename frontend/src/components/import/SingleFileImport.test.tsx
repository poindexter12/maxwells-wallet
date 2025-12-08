import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SingleFileImport } from './SingleFileImport'
import { AccountTag, SavedCustomFormat } from '@/types/import'

const mockAccounts: AccountTag[] = [
  { id: 1, namespace: 'account', value: 'Chase Checking' },
  { id: 2, namespace: 'account', value: 'Amex Gold' }
]

const mockSavedFormats: SavedCustomFormat[] = [
  { id: 1, name: 'My Custom Format', description: 'Custom CSV', config_json: '{}', use_count: 5 }
]

const mockPreview = {
  detected_format: 'chase_csv',
  transaction_count: 50,
  total_amount: -1500.50,
  transactions: [
    { date: '2024-01-15', merchant: 'Amazon', bucket: 'shopping', amount: -99.99 },
    { date: '2024-01-14', merchant: 'Starbucks', bucket: 'dining', amount: -5.50 }
  ],
  errors: []
}

describe('SingleFileImport', () => {
  const defaultProps = {
    file: null,
    setFile: vi.fn(),
    accounts: mockAccounts,
    accountSource: '',
    setAccountSource: vi.fn(),
    accountMode: 'existing' as const,
    setAccountMode: vi.fn(),
    formatHint: '',
    savedFormats: mockSavedFormats,
    selectedCustomFormat: null,
    preview: null,
    importing: false,
    onPreview: vi.fn(),
    onConfirm: vi.fn(),
    onCancelPreview: vi.fn(),
    onFormatChange: vi.fn()
  }

  it('renders file input', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByText('Import File')).toBeInTheDocument()
    expect(screen.getByTestId('import-file-input')).toBeInTheDocument()
  })

  it('renders account source section', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByText(/Account Source/)).toBeInTheDocument()
    expect(screen.getByText('Required for accurate duplicate detection')).toBeInTheDocument()
  })

  it('shows existing/new account toggle when accounts exist', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByText('Existing')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('hides existing/new toggle when no accounts', () => {
    render(<SingleFileImport {...defaultProps} accounts={[]} />)

    expect(screen.queryByText('Existing')).not.toBeInTheDocument()
    expect(screen.queryByText('New')).not.toBeInTheDocument()
  })

  it('shows account dropdown in existing mode', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByTestId('import-account-select')).toBeInTheDocument()
    expect(screen.getByText('-- Select Account --')).toBeInTheDocument()
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Amex Gold')).toBeInTheDocument()
  })

  it('shows text input in new account mode', () => {
    render(<SingleFileImport {...defaultProps} accountMode="new" accounts={[]} />)

    expect(screen.getByPlaceholderText('e.g., BOFA-Checking, AMEX-53004')).toBeInTheDocument()
  })

  it('calls setAccountMode when toggle clicked', () => {
    const setAccountMode = vi.fn()
    render(<SingleFileImport {...defaultProps} setAccountMode={setAccountMode} />)

    fireEvent.click(screen.getByText('New'))
    expect(setAccountMode).toHaveBeenCalledWith('new')
  })

  it('calls setAccountSource when account selected', () => {
    const setAccountSource = vi.fn()
    render(<SingleFileImport {...defaultProps} setAccountSource={setAccountSource} />)

    fireEvent.change(screen.getByTestId('import-account-select'), { target: { value: 'Chase Checking' } })
    expect(setAccountSource).toHaveBeenCalledWith('Chase Checking')
  })

  it('renders format selection with auto-detect', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByText('Format (Optional)')).toBeInTheDocument()
    expect(screen.getByText('Auto-detect')).toBeInTheDocument()
  })

  it('shows saved custom formats in dropdown', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByText('My Custom Format')).toBeInTheDocument()
  })

  it('calls onFormatChange when format selected', () => {
    const onFormatChange = vi.fn()
    render(<SingleFileImport {...defaultProps} onFormatChange={onFormatChange} />)

    fireEvent.change(screen.getByTestId('import-format-select'), { target: { value: 'qif' } })
    expect(onFormatChange).toHaveBeenCalledWith('qif')
  })

  it('disables preview button when no file', () => {
    render(<SingleFileImport {...defaultProps} />)

    const button = screen.getByTestId('import-preview-button')
    expect(button).toBeDisabled()
  })

  it('disables preview button when no account', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    render(<SingleFileImport {...defaultProps} file={file} accountSource="" />)

    const button = screen.getByTestId('import-preview-button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Select an Account to Preview')
  })

  it('enables preview button when file and account provided', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    render(<SingleFileImport {...defaultProps} file={file} accountSource="Chase Checking" />)

    const button = screen.getByTestId('import-preview-button')
    expect(button).not.toBeDisabled()
    expect(button).toHaveTextContent('Preview Import')
  })

  it('calls onPreview when preview button clicked', () => {
    const onPreview = vi.fn()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    render(<SingleFileImport {...defaultProps} file={file} accountSource="Chase Checking" onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId('import-preview-button'))
    expect(onPreview).toHaveBeenCalledTimes(1)
  })

  // Preview section tests
  describe('with preview', () => {
    const previewProps = {
      ...defaultProps,
      file: new File(['test'], 'test.csv', { type: 'text/csv' }),
      accountSource: 'Chase Checking',
      preview: mockPreview
    }

    it('renders preview header', () => {
      render(<SingleFileImport {...previewProps} />)

      expect(screen.getByText('Preview')).toBeInTheDocument()
    })

    it('displays detected format badge', () => {
      render(<SingleFileImport {...previewProps} />)

      expect(screen.getByText('chase_csv')).toBeInTheDocument()
    })

    it('shows transaction count and total', () => {
      render(<SingleFileImport {...previewProps} />)

      expect(screen.getByText('Transactions')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('Total Amount')).toBeInTheDocument()
    })

    it('renders transaction table', () => {
      render(<SingleFileImport {...previewProps} />)

      expect(screen.getByText('Amazon')).toBeInTheDocument()
      expect(screen.getByText('Starbucks')).toBeInTheDocument()
      expect(screen.getByText('shopping')).toBeInTheDocument()
      expect(screen.getByText('dining')).toBeInTheDocument()
    })

    it('shows parsing errors when present', () => {
      const previewWithErrors = {
        ...mockPreview,
        errors: ['Invalid date format on row 5', 'Missing amount on row 12']
      }
      render(<SingleFileImport {...previewProps} preview={previewWithErrors} />)

      expect(screen.getByText('Parsing Errors:')).toBeInTheDocument()
      expect(screen.getByText('Invalid date format on row 5')).toBeInTheDocument()
      expect(screen.getByText('Missing amount on row 12')).toBeInTheDocument()
    })

    it('renders confirm and cancel buttons', () => {
      render(<SingleFileImport {...previewProps} />)

      expect(screen.getByTestId('import-confirm-button')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('calls onConfirm when confirm clicked', () => {
      const onConfirm = vi.fn()
      render(<SingleFileImport {...previewProps} onConfirm={onConfirm} />)

      fireEvent.click(screen.getByTestId('import-confirm-button'))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('calls onCancelPreview when cancel clicked', () => {
      const onCancelPreview = vi.fn()
      render(<SingleFileImport {...previewProps} onCancelPreview={onCancelPreview} />)

      fireEvent.click(screen.getByText('Cancel'))
      expect(onCancelPreview).toHaveBeenCalledTimes(1)
    })

    it('shows importing state', () => {
      render(<SingleFileImport {...previewProps} importing={true} />)

      expect(screen.getByText('Importing...')).toBeInTheDocument()
      expect(screen.getByTestId('import-confirm-button')).toBeDisabled()
    })

    it('shows custom format name when selected', () => {
      const customFormat: SavedCustomFormat = {
        id: 1,
        name: 'My Custom Format',
        description: null,
        config_json: '{}',
        use_count: 5
      }
      render(<SingleFileImport {...previewProps} selectedCustomFormat={customFormat} />)

      expect(screen.getByText('Using saved format: My Custom Format')).toBeInTheDocument()
    })
  })
})
