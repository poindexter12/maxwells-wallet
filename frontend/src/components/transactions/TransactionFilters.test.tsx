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

  // --- Account dropdown include/exclude logic ---

  describe('account dropdown interactions', () => {
    it('click includes an account', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} showAccountDropdown={true} setFilters={setFilters} />)

      const accountOption = screen.getByText('Chase Checking')
      fireEvent.click(accountOption)

      expect(setFilters).toHaveBeenCalledWith({
        ...defaultFilters,
        accounts: ['chase-checking'],
        accountsExclude: [],
      })
    })

    it('click removes already-included account', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accounts: ['chase-checking'] }
      render(<TransactionFilters {...defaultProps} filters={filters} showAccountDropdown={true} setFilters={setFilters} />)

      const accountOption = screen.getByText('Chase Checking')
      fireEvent.click(accountOption)

      expect(setFilters).toHaveBeenCalledWith({
        ...filters,
        accounts: [],
      })
    })

    it('shift+click excludes an account', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} showAccountDropdown={true} setFilters={setFilters} />)

      const accountOption = screen.getByText('Chase Checking')
      fireEvent.click(accountOption, { shiftKey: true })

      expect(setFilters).toHaveBeenCalledWith({
        ...defaultFilters,
        accounts: [],
        accountsExclude: ['chase-checking'],
      })
    })

    it('shift+click removes already-excluded account', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accountsExclude: ['chase-checking'] }
      render(<TransactionFilters {...defaultProps} filters={filters} showAccountDropdown={true} setFilters={setFilters} />)

      const accountOption = screen.getByText('Chase Checking')
      fireEvent.click(accountOption, { shiftKey: true })

      expect(setFilters).toHaveBeenCalledWith({
        ...filters,
        accountsExclude: [],
      })
    })

    it('shift+click on included account moves it to excluded', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accounts: ['chase-checking'] }
      render(<TransactionFilters {...defaultProps} filters={filters} showAccountDropdown={true} setFilters={setFilters} />)

      const accountOption = screen.getByText('Chase Checking')
      fireEvent.click(accountOption, { shiftKey: true })

      expect(setFilters).toHaveBeenCalledWith({
        ...filters,
        accounts: [],
        accountsExclude: ['chase-checking'],
      })
    })

    it('click on excluded account moves it to included', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accountsExclude: ['amex-gold'] }
      render(<TransactionFilters {...defaultProps} filters={filters} showAccountDropdown={true} setFilters={setFilters} />)

      const accountOption = screen.getByText('Amex Gold')
      fireEvent.click(accountOption)

      expect(setFilters).toHaveBeenCalledWith({
        ...filters,
        accounts: ['amex-gold'],
        accountsExclude: [],
      })
    })

    it('shows clear button when accounts are selected', () => {
      const filters = { ...defaultFilters, accounts: ['chase-checking'] }
      render(<TransactionFilters {...defaultProps} filters={filters} showAccountDropdown={true} />)

      expect(screen.getByText('bulk.clearSelection')).toBeInTheDocument()
    })

    it('clear button resets accounts and accountsExclude', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accounts: ['chase-checking'], accountsExclude: ['amex-gold'] }
      render(<TransactionFilters {...defaultProps} filters={filters} showAccountDropdown={true} setFilters={setFilters} />)

      fireEvent.click(screen.getByText('bulk.clearSelection'))

      expect(setFilters).toHaveBeenCalledWith({ ...filters, accounts: [], accountsExclude: [] })
    })

    it('shows selected count in button text', () => {
      const filters = { ...defaultFilters, accounts: ['chase-checking', 'amex-gold'] }
      render(<TransactionFilters {...defaultProps} filters={filters} />)

      expect(screen.getByTestId(TEST_IDS.FILTER_ACCOUNT)).toHaveTextContent('2 selected')
    })

    it('shows excluded count in button text', () => {
      const filters = { ...defaultFilters, accountsExclude: ['chase-checking'] }
      render(<TransactionFilters {...defaultProps} filters={filters} />)

      expect(screen.getByTestId(TEST_IDS.FILTER_ACCOUNT)).toHaveTextContent('Excluding 1')
    })
  })

  // --- Quick filter date calculations ---

  describe('quick filter date math', () => {
    it('Last Month sets correct date range', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_LAST_MONTH))

      const call = setFilters.mock.calls[0][0]
      // Compute expected values the same way the component does (local time)
      const now = new Date()
      const expectedFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const expectedLast = new Date(now.getFullYear(), now.getMonth(), 0)
      expect(call.startDate).toBe(expectedFirst.toISOString().split('T')[0])
      expect(call.endDate).toBe(expectedLast.toISOString().split('T')[0])
    })

    it('This Year sets Jan 1 to Dec 31', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_THIS_YEAR))

      const call = setFilters.mock.calls[0][0]
      const year = new Date().getFullYear()
      expect(call.startDate).toBe(`${year}-01-01`)
      expect(call.endDate).toBe(`${year}-12-31`)
    })

    it('YTD sets Jan 1 to today', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_YTD))

      const call = setFilters.mock.calls[0][0]
      const today = new Date()
      const year = today.getFullYear()
      expect(call.startDate).toBe(`${year}-01-01`)
      expect(call.endDate).toBe(today.toISOString().split('T')[0])
    })

    it('Last 90 Days sets date 90 days ago to today', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_LAST_90_DAYS))

      const call = setFilters.mock.calls[0][0]
      const today = new Date()
      const past = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
      expect(call.startDate).toBe(past.toISOString().split('T')[0])
      expect(call.endDate).toBe(today.toISOString().split('T')[0])
    })
  })

  // --- Insight quick filters ---

  describe('insight quick filters', () => {
    it('Large Dynamic uses largeThreshold when provided', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} largeThreshold={250} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_LARGE_DYNAMIC))

      const call = setFilters.mock.calls[0][0]
      expect(call.amountMax).toBe('-250')
      expect(call.amountMin).toBe('')
    })

    it('Large Dynamic falls back to default threshold when largeThreshold is null', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} largeThreshold={null} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_LARGE_DYNAMIC))

      const call = setFilters.mock.calls[0][0]
      // getDefaultLargeThreshold mocked to return 100
      expect(call.amountMax).toBe('-100')
    })

    it('Top Spending sets amountMax to -50 with this month dates', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_TOP_SPENDING))

      const call = setFilters.mock.calls[0][0]
      expect(call.amountMax).toBe('-50')
      expect(call.amountMin).toBe('')
      // Should have date range set to this month
      expect(call.startDate).toBeTruthy()
      expect(call.endDate).toBeTruthy()
    })

    it('Large (all time) sets amountMax without date range', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} setFilters={setFilters} />)

      fireEvent.click(screen.getByTestId(TEST_IDS.QUICK_FILTER_LARGE))

      const call = setFilters.mock.calls[0][0]
      expect(call.amountMax).toBe('-100')
      // Should NOT set date range (all time)
      expect(call.startDate).toBe('')
      expect(call.endDate).toBe('')
    })
  })

  // --- Advanced filter interactions ---

  describe('advanced filter details', () => {
    it('changes transfers filter', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} setFilters={setFilters} />)

      const select = screen.getByTestId(TEST_IDS.FILTER_TRANSFERS)
      fireEvent.change(select, { target: { value: 'only' } })

      expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, transfers: 'only' })
    })

    it('changes amount max', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} setFilters={setFilters} />)

      const maxInput = screen.getByTestId(TEST_IDS.FILTER_AMOUNT_MAX)
      fireEvent.change(maxInput, { target: { value: '-500' } })

      expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, amountMax: '-500' })
    })

    it('changes end date', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} showAdvancedFilters={true} setFilters={setFilters} />)

      const endInput = screen.getByTestId(TEST_IDS.FILTER_DATE_END)
      fireEvent.change(endInput, { target: { value: '2026-12-31' } })

      expect(setFilters).toHaveBeenCalledWith({ ...defaultFilters, endDate: '2026-12-31' })
    })
  })

  // --- Active filter pill removal ---

  describe('filter pill removal', () => {
    it('removes occasion filter pill', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, occasion: 'date-night' }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      // Find the occasion pill's close button
      const pill = screen.getByText(/occasion:/i).parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({ ...filters, occasion: '' })
    })

    it('removes included account pill', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accounts: ['chase-checking', 'amex-gold'] }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      // Find the Chase Checking pill's close button
      const pill = screen.getByText(/Chase Checking/).parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({
        ...filters,
        accounts: ['amex-gold'],
      })
    })

    it('removes excluded account pill', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, accountsExclude: ['amex-gold'] }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      const pill = screen.getByText(/NOT:.*Amex Gold/).parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({
        ...filters,
        accountsExclude: [],
      })
    })

    it('removes status filter pill', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, status: 'matched' }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      const pill = screen.getByText(/status:/i).parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({ ...filters, status: '' })
    })

    it('removes amount range pill', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, amountMin: '-50', amountMax: '-200' }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      const pill = screen.getByText(/amount:/i).parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({ ...filters, amountMin: '', amountMax: '' })
    })

    it('removes date range pill', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, startDate: '2026-01-01', endDate: '2026-06-30' }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      const pill = screen.getByText(/date:/i).parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({ ...filters, startDate: '', endDate: '' })
    })

    it('removes transfers pill (resets to hide)', () => {
      const setFilters = vi.fn()
      const filters = { ...defaultFilters, transfers: 'all' as const }
      render(<TransactionFilters {...defaultProps} filters={filters} setFilters={setFilters} />)

      // The transfer pill shows translation key for 'showTransfers'
      const pill = screen.getByText('showTransfers').parentElement!
      const closeBtn = pill.querySelector('button')!
      fireEvent.click(closeBtn)

      expect(setFilters).toHaveBeenCalledWith({ ...filters, transfers: 'hide' })
    })

    it('shows transfers-only pill text correctly', () => {
      const filters = { ...defaultFilters, transfers: 'only' as const }
      render(<TransactionFilters {...defaultProps} filters={filters} />)

      expect(screen.getByText('transfersOnly')).toBeInTheDocument()
    })
  })

  // --- Edge cases ---

  describe('edge cases', () => {
    it('does not show active pills when all filters are default', () => {
      render(<TransactionFilters {...defaultProps} />)
      // No pills should be rendered
      expect(screen.queryByText('×')).not.toBeInTheDocument()
    })

    it('does not trigger search on non-Enter keys', () => {
      const setFilters = vi.fn()
      render(<TransactionFilters {...defaultProps} searchInput="test" setFilters={setFilters} />)

      fireEvent.keyDown(screen.getByTestId(TEST_IDS.FILTER_SEARCH), { key: 'a' })
      expect(setFilters).not.toHaveBeenCalled()
    })

    it('shows amount pill with infinity symbol when only min is set', () => {
      const filters = { ...defaultFilters, amountMin: '-50' }
      render(<TransactionFilters {...defaultProps} filters={filters} />)

      expect(screen.getByText(/∞/)).toBeInTheDocument()
    })

    it('account button shows allAccounts when no accounts selected', () => {
      render(<TransactionFilters {...defaultProps} />)
      expect(screen.getByTestId(TEST_IDS.FILTER_ACCOUNT)).toHaveTextContent('allAccounts')
    })
  })
})
