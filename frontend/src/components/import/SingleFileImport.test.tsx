import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SingleFileImport } from './SingleFileImport'
import { AccountTag, SavedCustomFormat } from '@/types/import'
import { TEST_IDS } from '@/test-ids'

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

    expect(screen.getByTestId(TEST_IDS.IMPORT_FILE_INPUT)).toBeInTheDocument()
  })

  it('renders account select dropdown', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_ACCOUNT_SELECT)).toBeInTheDocument()
  })

  it('calls setAccountSource when account selected', () => {
    const setAccountSource = vi.fn()
    render(<SingleFileImport {...defaultProps} setAccountSource={setAccountSource} />)

    fireEvent.change(screen.getByTestId(TEST_IDS.IMPORT_ACCOUNT_SELECT), { target: { value: 'Chase Checking' } })
    expect(setAccountSource).toHaveBeenCalledWith('Chase Checking')
  })

  it('renders format selection', () => {
    render(<SingleFileImport {...defaultProps} />)

    expect(screen.getByTestId(TEST_IDS.IMPORT_FORMAT_SELECT)).toBeInTheDocument()
  })

  it('calls onFormatChange when format selected', () => {
    const onFormatChange = vi.fn()
    render(<SingleFileImport {...defaultProps} onFormatChange={onFormatChange} />)

    fireEvent.change(screen.getByTestId(TEST_IDS.IMPORT_FORMAT_SELECT), { target: { value: 'qif' } })
    expect(onFormatChange).toHaveBeenCalledWith('qif')
  })

  it('disables preview button when no file', () => {
    render(<SingleFileImport {...defaultProps} />)

    const button = screen.getByTestId(TEST_IDS.IMPORT_PREVIEW_BUTTON)
    expect(button).toBeDisabled()
  })

  it('disables preview button when no account', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    render(<SingleFileImport {...defaultProps} file={file} accountSource="" />)

    const button = screen.getByTestId(TEST_IDS.IMPORT_PREVIEW_BUTTON)
    expect(button).toBeDisabled()
  })

  it('enables preview button when file and account provided', () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    render(<SingleFileImport {...defaultProps} file={file} accountSource="Chase Checking" />)

    const button = screen.getByTestId(TEST_IDS.IMPORT_PREVIEW_BUTTON)
    expect(button).not.toBeDisabled()
  })

  it('calls onPreview when preview button clicked', () => {
    const onPreview = vi.fn()
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    render(<SingleFileImport {...defaultProps} file={file} accountSource="Chase Checking" onPreview={onPreview} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.IMPORT_PREVIEW_BUTTON))
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

    it('renders confirm button when preview shown', () => {
      render(<SingleFileImport {...previewProps} />)

      expect(screen.getByTestId(TEST_IDS.IMPORT_CONFIRM_BUTTON)).toBeInTheDocument()
    })

    it('calls onConfirm when confirm clicked', () => {
      const onConfirm = vi.fn()
      render(<SingleFileImport {...previewProps} onConfirm={onConfirm} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.IMPORT_CONFIRM_BUTTON))
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('disables confirm button when importing', () => {
      render(<SingleFileImport {...previewProps} importing={true} />)

      expect(screen.getByTestId(TEST_IDS.IMPORT_CONFIRM_BUTTON)).toBeDisabled()
    })
  })
})
