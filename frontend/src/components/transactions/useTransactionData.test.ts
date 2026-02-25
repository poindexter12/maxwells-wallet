import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTransactionData } from './useTransactionData'

// Spy on globalThis.fetch — works with Node 22+ native fetch
let mockFetch: ReturnType<typeof vi.fn>

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

describe('useTransactionData', () => {
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

  beforeEach(() => {
    // Intercept native fetch with a spy
    mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with loading state', () => {
    const { result } = renderHook(() =>
      useTransactionData({
        filters: defaultFilters,
        filtersInitialized: false,
        debouncedFilters: JSON.stringify(defaultFilters),
      })
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.transactions).toEqual([])
  })

  it('provides expected API functions', () => {
    const { result } = renderHook(() =>
      useTransactionData({
        filters: defaultFilters,
        filtersInitialized: false,
        debouncedFilters: JSON.stringify(defaultFilters),
      })
    )

    expect(typeof result.current.loadMoreTransactions).toBe('function')
    expect(typeof result.current.fetchTransactions).toBe('function')
    expect(typeof result.current.setTransactions).toBe('function')
  })

  it('provides expected state values', () => {
    const { result } = renderHook(() =>
      useTransactionData({
        filters: defaultFilters,
        filtersInitialized: false,
        debouncedFilters: JSON.stringify(defaultFilters),
      })
    )

    expect(Array.isArray(result.current.transactions)).toBe(true)
    expect(Array.isArray(result.current.bucketTags)).toBe(true)
    expect(Array.isArray(result.current.occasionTags)).toBe(true)
    expect(Array.isArray(result.current.accountTags)).toBe(true)
    expect(Array.isArray(result.current.allTags)).toBe(true)
    expect(typeof result.current.loading).toBe('boolean')
    expect(typeof result.current.loadingMore).toBe('boolean')
    expect(typeof result.current.hasMore).toBe('boolean')
    expect(typeof result.current.totalCount).toBe('number')
  })

  it('fetches transactions when filtersInitialized is true', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/v1/transactions/paginated')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [{ id: 1, amount: -50, description: 'Test' }],
            next_cursor: null,
            has_more: false,
          }),
        })
      }
      if (url.includes('/api/v1/transactions/1/tags')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ tags: [] }),
        })
      }
      if (url.includes('/api/v1/transactions/count')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ count: 1 }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => [],
      })
    })

    const { result } = renderHook(() =>
      useTransactionData({
        filters: defaultFilters,
        filtersInitialized: true,
        debouncedFilters: JSON.stringify(defaultFilters),
      })
    )

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false)
      },
      { timeout: 3000 }
    )

    expect(result.current.transactions.length).toBeGreaterThan(0)
  })

  it('does not fetch transactions when filtersInitialized is false', async () => {
    renderHook(() =>
      useTransactionData({
        filters: defaultFilters,
        filtersInitialized: false,
        debouncedFilters: JSON.stringify(defaultFilters),
      })
    )

    await waitFor(
      () => {
        const callCount = mockFetch.mock.calls.length
        // Only tag fetches should happen (4 endpoints)
        expect(callCount).toBeGreaterThanOrEqual(4)
      },
      { timeout: 1000 }
    )

    // Check that paginated endpoint was NOT called
    const paginatedCalls = mockFetch.mock.calls.filter((call) =>
      call[0].includes('/api/v1/transactions/paginated')
    )
    expect(paginatedCalls).toHaveLength(0)
  })

  it('builds URL with search param', async () => {
    const filters = { ...defaultFilters, search: 'coffee' }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        next_cursor: null,
        has_more: false,
      }),
    })

    renderHook(() =>
      useTransactionData({
        filters,
        filtersInitialized: true,
        debouncedFilters: JSON.stringify(filters),
      })
    )

    await waitFor(() => {
      const paginatedCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes('/api/v1/transactions/paginated')
      )
      expect(paginatedCalls.length).toBeGreaterThan(0)
      expect(paginatedCalls[0][0]).toContain('search=coffee')
    }, { timeout: 2000 })
  })

  it('builds URL with bucket param', async () => {
    const filters = { ...defaultFilters, bucket: 'groceries' }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        next_cursor: null,
        has_more: false,
      }),
    })

    renderHook(() =>
      useTransactionData({
        filters,
        filtersInitialized: true,
        debouncedFilters: JSON.stringify(filters),
      })
    )

    await waitFor(() => {
      const paginatedCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes('/api/v1/transactions/paginated')
      )
      expect(paginatedCalls.length).toBeGreaterThan(0)
      expect(paginatedCalls[0][0]).toContain('tag=bucket%3Agroceries')
    }, { timeout: 2000 })
  })

  it('builds URL with transfer filter', async () => {
    const filters = { ...defaultFilters, transfers: 'hide' as const }

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        next_cursor: null,
        has_more: false,
      }),
    })

    renderHook(() =>
      useTransactionData({
        filters,
        filtersInitialized: true,
        debouncedFilters: JSON.stringify(filters),
      })
    )

    await waitFor(() => {
      const paginatedCalls = mockFetch.mock.calls.filter((call) =>
        call[0].includes('/api/v1/transactions/paginated')
      )
      expect(paginatedCalls.length).toBeGreaterThan(0)
      expect(paginatedCalls[0][0]).toContain('is_transfer=false')
    }, { timeout: 2000 })
  })

  it('cancels requests on unmount', () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

    const { unmount } = renderHook(() =>
      useTransactionData({
        filters: defaultFilters,
        filtersInitialized: true,
        debouncedFilters: JSON.stringify(defaultFilters),
      })
    )

    unmount()

    expect(abortSpy).toHaveBeenCalled()
  })
})
