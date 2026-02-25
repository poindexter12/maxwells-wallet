import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TEST_IDS } from '@/test-ids'
import { TransactionFilters } from './TransactionFilters'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock useFormat hook
vi.mock('@/hooks/useFormat', () => ({
  useFormat: () => ({
    formatCurrency: (value: number) => `$${value}`,
    getDefaultLargeThreshold: () => 100,
  }),
}))

// Mock DatePicker component
vi.mock('@/components/DatePicker', () => ({
  DatePicker: ({ value, onChange, 'data-testid': testId }: any) => (
    <input
      data-testid={testId}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface FilterState {
  search: string
  bucket: string
  occasion: string
  accounts: string[]
  accountsExclude: string[]
  status: string
  amountMin: string
  amountMax: string
  startDate: string
  endDate: string
  transfers: 'all' | 'hide' | 'only'
}

describe('TransactionFilters', () => {
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

  const defaultFilters: FilterState = {
    search: '',
    bucket: '',
    occasion: '',
    accounts: [],
    accountsExclude: [],
    status: '',
    amountMin: '',
    amountMax: '',
    startDate: '',
    endDate: '',
    transfers: 'hide',
  }

  const defaultProps = {
    filters: defaultFilters,
    setFilters: vi.fn(),
    searchInput: '',
    setSearchInput: vi.fn(),
    showAdvancedFilters: false,
    setShowAdvancedFilters: vi.fn(),
    showAccountDropdown: false,
    setShowAccountDropdown: vi.fn(),
    bucketTags: mockBucketTags,
    occasionTags: mockOccasionTags,
    accountTags: mockAccountTags,
    largeThreshold: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input', () => {
    render(<TransactionFilters {...defaultProps} />)
    expect(screen.getByTestId(TEST_IDS.FILTER_SEARCH)).toBeInTheDocument()
  })

  it('calls setSearchInput when search input changes', () => {
    const setSearchInput = vi.fn()
    render(<TransactionFilters {...defaultProps} setSearchInput={setSearchInput} />)

    const input = screen.getByTestId(TEST_IDS.FILTER_SEARCH)
    fireEvent.change(input, { target: { value: 'coffee' } })

    expect(setSearchInput).toHaveBeenCalledWith('coffee')
  })

  it('calls setFilters when Enter pressed in search input', () => {
    const setFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} searchInput="coffee" setFilters={setFilters} />)

    const input = screen.getByTestId(TEST_IDS.FILTER_SEARCH)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, search: 'coffee' })
  })

  it('renders bucket filter dropdown', () => {
    render(<TransactionFilters {...defaultProps} />)
    expect(screen.getByTestId(TEST_IDS.FILTER_BUCKET)).toBeInTheDocument()
  })

  it('renders occasion filter dropdown', () => {
    render(<TransactionFilters {...defaultProps} />)
    expect(screen.getByTestId(TEST_IDS.FILTER_OCCASION)).toBeInTheDocument()
  })

  it('renders account filter button', () => {
    render(<TransactionFilters {...defaultProps} />)
    expect(screen.getByTestId(TEST_IDS.FILTER_ACCOUNT)).toBeInTheDocument()
  })

  it('calls setFilters when bucket selected', () => {
    const setFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

    const select = screen.getByTestId(TEST_IDS.FILTER_BUCKET)
    fireEvent.change(select, { target: { value: 'groceries' } })

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, bucket: 'groceries' })
  })

  it('calls setFilters when occasion selected', () => {
    const setFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

    const select = screen.getByTestId(TEST_IDS.FILTER_OCCASION)
    fireEvent.change(select, { target: { value: 'weekly-shopping' } })

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, occasion: 'weekly-shopping' })
  })

  it('renders quick date filters', () => {
    render(<TransactionFilters {...defaultProps} />)

    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_THIS_MONTH)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_LAST_MONTH)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_THIS_YEAR)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_YTD)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_LAST_90_DAYS)).toBeInTheDocument()
  })

  it('renders quick insight filters', () => {
    render(<TransactionFilters {...defaultProps} />)

    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_LARGE_DYNAMIC)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_TOP_SPENDING)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_LARGE)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.QUICK_FILTER_UNRECONCILED)).toBeInTheDocument()
  })

  it('calls setFilters when This Month clicked', () => {
    const setFilters = vi.fn()
    const setShowAdvancedFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} setFilters={setFilters} setShowAdvancedFilters={setShowAdvancedFilters} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_THIS_MONTH))

    expect(setFilters).toHaveBeenCalled()
    expect(setShowAdvancedFilters).toHaveBeenCalledWith(true)
  })

  it('calls setFilters when Unreconciled clicked', () => {
    const setFilters = vi.fn()
    const setShowAdvancedFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} setFilters={setFilters} setShowAdvancedFilters={setShowAdvancedFilters} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_UNRECONCILED))

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, status: 'unreconciled' })
    expect(setShowAdvancedFilters).toHaveBeenCalledWith(true)
  })

  it('toggles advanced filters when button clicked', () => {
    const setShowAdvancedFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} setShowAdvancedFilters={setShowAdvancedFilters} />)

    const toggleBtn = screen.getByTestId(TEST_IDS.FILTER_ADVANCED_TOGGLE)
    fireEvent.click(toggleBtn)

    expect(setShowAdvancedFilters).toHaveBeenCalledWith(true)
  })

  it('renders advanced filters when showAdvancedFilters is true', () => {
    render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} />)

    expect(screen.getByTestId(TEST_IDS.FILTER_STATUS)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.FILTER_TRANSFERS)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.FILTER_AMOUNT_MIN)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.FILTER_AMOUNT_MAX)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.FILTER_DATE_START)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.FILTER_DATE_END)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.FILTER_CLEAR)).toBeInTheDocument()
  })

  it('does not render advanced filters when showAdvancedFilters is false', () => {
    render(<TransactionFilters {...defaultProps} showAdvancedFilters={false} />)

    expect(screen.queryByTestId(TEST_IDS.FILTER_STATUS)).not.toBeInTheDocument()
    expect(screen.queryByTestId(TEST_IDS.FILTER_TRANSFERS)).not.toBeInTheDocument()
  })

  it('calls setFilters when status selected in advanced filters', () => {
    const setFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} setFilters={setFilters} />)

    const select = screen.getByTestId(TEST_IDS.FILTER_STATUS)
    fireEvent.change(select, { target: { value: 'matched' } })

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, status: 'matched' })
  })

  it('calls setFilters when amount min/max changed', () => {
    const setFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} setFilters={setFilters} />)

    const minInput = screen.getByTestId(TEST_IDS.FILTER_AMOUNT_MIN)
    fireEvent.change(minInput, { target: { value: '-100' } })

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, amountMin: '-100' })
  })

  it('calls setFilters when date range changed', () => {
    const setFilters = vi.fn()
    render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} setFilters={setFilters} />)

    const startInput = screen.getByTestId(TEST_IDS.FILTER_DATE_START)
    fireEvent.change(startInput, { target: { value: '2024-01-01' } })

    expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, startDate: '2024-01-01' })
  })

  it('clears all filters when clear button clicked', () => {
    const setFilters = vi.fn()
    const setSearchInput = vi.fn()
    const setShowAccountDropdown = vi.fn()
    render(<TransactionFilters
      {...defaultProps}
      showAdvancedFilters={true}
      setFilters={setFilters}
      setSearchInput={setSearchInput}
      setShowAccountDropdown={setShowAccountDropdown}
    />)

    fireEvent.click(screen.getByTestId(TEST_IDS.FILTER_CLEAR))

    expect(setSearchInput).toHaveBeenCalledWith('')
    expect(setFilters).toHaveBeenCalledWith(defaultFilters)
    expect(setShowAccountDropdown).toHaveBeenCalledWith(false)
  })

  it('renders active filter pills when filters applied', () => {
    const filters = { ...defaultFilters, bucket: 'groceries', status: 'unreconciled' }
    render(<TransactionFilters {...defaultProps} filters={filters} />)

    // Pills are rendered within a filter container below the main filter inputs
    const pillContainer = screen.getByText(/bucket:/i).parentElement
    expect(pillContainer).toBeInTheDocument()
    expect(pillContainer).toHaveTextContent('groceries')
  })

  it('removes bucket filter when pill close button clicked', () => {
    const setFilters = vi.fn()
    const filters = { ...defaultFilters, bucket: 'groceries' }
    render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

    const closeButton = screen.getByText('×')
    fireEvent.click(closeButton)

    expect(setFilters).toHaveBeenCalledWith({ ...filters, bucket: '' })
  })

  it('toggles account dropdown when button clicked', () => {
    const setShowAccountDropdown = vi.fn()
    render(<TransactionFilters {...defaultProps} setShowAccountDropdown={setShowAccountDropdown} />)

    fireEvent.click(screen.getByTestId(TEST_IDS.FILTER_ACCOUNT))

    expect(setShowAccountDropdown).toHaveBeenCalledWith(true)
  })
})
