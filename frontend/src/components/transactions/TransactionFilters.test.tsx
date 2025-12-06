import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TransactionFiltersComponent from './TransactionFilters'
import { Tag, INITIAL_FILTERS, TransactionFilters } from '@/types/transactions'

const mockBucketTags: Tag[] = [
  { id: 1, namespace: 'bucket', value: 'groceries' },
  { id: 2, namespace: 'bucket', value: 'dining' },
]

const mockOccasionTags: Tag[] = [
  { id: 3, namespace: 'occasion', value: 'vacation-2024' },
]

const mockAccountTags: Tag[] = [
  { id: 4, namespace: 'account', value: 'checking', description: 'Main Checking' },
  { id: 5, namespace: 'account', value: 'savings', description: 'Savings' },
]

describe('TransactionFilters', () => {
  const defaultProps = {
    filters: INITIAL_FILTERS,
    searchInput: '',
    bucketTags: mockBucketTags,
    occasionTags: mockOccasionTags,
    accountTags: mockAccountTags,
    largeThreshold: 100,
    onFiltersChange: vi.fn(),
    onSearchInputChange: vi.fn(),
    onSearch: vi.fn(),
  }

  it('renders quick filters', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('quick-filters')).toBeInTheDocument()
  })

  it('renders main filters', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('main-filters')).toBeInTheDocument()
  })

  it('renders search input', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('filter-search')).toBeInTheDocument()
  })

  it('renders bucket dropdown', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('filter-bucket')).toBeInTheDocument()
  })

  it('renders occasion dropdown', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('filter-occasion')).toBeInTheDocument()
  })

  it('calls onSearchInputChange when search input changed', async () => {
    const user = userEvent.setup()
    const onSearchInputChange = vi.fn()
    render(<TransactionFiltersComponent {...defaultProps} onSearchInputChange={onSearchInputChange} />)

    await user.type(screen.getByTestId('filter-search'), 'test')
    expect(onSearchInputChange).toHaveBeenCalled()
  })

  it('calls onSearch when Enter pressed in search', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<TransactionFiltersComponent {...defaultProps} onSearch={onSearch} />)

    const searchInput = screen.getByTestId('filter-search')
    await user.type(searchInput, '{Enter}')
    expect(onSearch).toHaveBeenCalled()
  })

  it('calls onSearch when search button clicked', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    render(<TransactionFiltersComponent {...defaultProps} onSearch={onSearch} />)

    await user.click(screen.getByTestId('search-btn'))
    expect(onSearch).toHaveBeenCalled()
  })

  it('calls onFiltersChange when bucket changed', async () => {
    const user = userEvent.setup()
    const onFiltersChange = vi.fn()
    render(<TransactionFiltersComponent {...defaultProps} onFiltersChange={onFiltersChange} />)

    await user.selectOptions(screen.getByTestId('filter-bucket'), 'groceries')
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'groceries' }))
  })

  it('calls onFiltersChange when occasion changed', async () => {
    const user = userEvent.setup()
    const onFiltersChange = vi.fn()
    render(<TransactionFiltersComponent {...defaultProps} onFiltersChange={onFiltersChange} />)

    await user.selectOptions(screen.getByTestId('filter-occasion'), 'vacation-2024')
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ occasion: 'vacation-2024' }))
  })

  it('shows advanced filters toggle button', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('toggle-advanced-btn')).toBeInTheDocument()
  })

  it('shows advanced filters when toggle clicked', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    expect(screen.getByTestId('advanced-filters')).toBeInTheDocument()
  })

  it('shows advanced filters when has active advanced filter', () => {
    const filters: TransactionFilters = { ...INITIAL_FILTERS, status: 'unreconciled' }
    render(<TransactionFiltersComponent {...defaultProps} filters={filters} />)
    expect(screen.getByTestId('advanced-filters')).toBeInTheDocument()
  })

  it('shows status filter in advanced section', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    expect(screen.getByTestId('filter-status')).toBeInTheDocument()
  })

  it('shows transfers filter in advanced section', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    expect(screen.getByTestId('filter-transfers')).toBeInTheDocument()
  })

  it('shows date inputs in advanced section', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    expect(screen.getByTestId('filter-start-date')).toBeInTheDocument()
    expect(screen.getByTestId('filter-end-date')).toBeInTheDocument()
  })

  it('shows amount inputs in advanced section', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    expect(screen.getByTestId('filter-amount-min')).toBeInTheDocument()
    expect(screen.getByTestId('filter-amount-max')).toBeInTheDocument()
  })

  it('shows clear all button in advanced section', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    expect(screen.getByTestId('clear-all-btn')).toBeInTheDocument()
  })

  it('clears filters when clear all clicked', async () => {
    const user = userEvent.setup()
    const onFiltersChange = vi.fn()
    const onSearchInputChange = vi.fn()
    const filters: TransactionFilters = { ...INITIAL_FILTERS, bucket: 'groceries' }
    render(<TransactionFiltersComponent {...defaultProps} filters={filters} onFiltersChange={onFiltersChange} onSearchInputChange={onSearchInputChange} />)

    await user.click(screen.getByTestId('toggle-advanced-btn'))
    await user.click(screen.getByTestId('clear-all-btn'))
    expect(onFiltersChange).toHaveBeenCalledWith(INITIAL_FILTERS)
    expect(onSearchInputChange).toHaveBeenCalledWith('')
  })

  it('shows active filter pills when filters applied', () => {
    const filters: TransactionFilters = { ...INITIAL_FILTERS, bucket: 'groceries' }
    render(<TransactionFiltersComponent {...defaultProps} filters={filters} />)
    expect(screen.getByTestId('active-filters')).toBeInTheDocument()
    expect(screen.getByText(/Bucket: groceries/)).toBeInTheDocument()
  })

  it('shows quick filter buttons', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('quick-filter-this-month')).toBeInTheDocument()
    expect(screen.getByTestId('quick-filter-last-month')).toBeInTheDocument()
    expect(screen.getByTestId('quick-filter-this-year')).toBeInTheDocument()
    expect(screen.getByTestId('quick-filter-ytd')).toBeInTheDocument()
  })

  it('applies this month filter when clicked', async () => {
    const user = userEvent.setup()
    const onFiltersChange = vi.fn()
    render(<TransactionFiltersComponent {...defaultProps} onFiltersChange={onFiltersChange} />)

    await user.click(screen.getByTestId('quick-filter-this-month'))
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
      startDate: expect.any(String),
      endDate: expect.any(String)
    }))
  })

  it('shows account filter dropdown', () => {
    render(<TransactionFiltersComponent {...defaultProps} />)
    expect(screen.getByTestId('filter-accounts-btn')).toBeInTheDocument()
  })

  it('shows account options when dropdown clicked', async () => {
    const user = userEvent.setup()
    render(<TransactionFiltersComponent {...defaultProps} />)

    await user.click(screen.getByTestId('filter-accounts-btn'))
    expect(screen.getByTestId('accounts-dropdown')).toBeInTheDocument()
    expect(screen.getByTestId('account-option-checking')).toBeInTheDocument()
  })

  it('displays large threshold in quick filter button', () => {
    render(<TransactionFiltersComponent {...defaultProps} largeThreshold={200} />)
    expect(screen.getByText(/Large.*\$200\+/)).toBeInTheDocument()
  })
})
