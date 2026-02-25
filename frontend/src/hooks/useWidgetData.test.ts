import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  useDashboardParams,
  useSummaryData,
  useMonthOverMonthData,
  useSpendingVelocityData,
  useAnomaliesData,
  useTrendsData,
  useTopMerchantsData,
  useSankeyData,
  useTreemapData,
  useHeatmapData,
  useBucketData
} from './useWidgetData'

// Mock SWR
const mockUseSWR = vi.fn()
vi.mock('swr', () => ({
  default: (...args: unknown[]) => mockUseSWR(...args)
}))

// Mock toast
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: mockToastError }
}))

// Mock DashboardContext
const mockUseDashboard = vi.fn()
vi.mock('@/contexts/DashboardContext', () => ({
  useDashboard: () => mockUseDashboard()
}))

describe('useDashboardParams', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns null values when currentDashboard is null', () => {
    mockUseDashboard.mockReturnValue({ currentDashboard: null })

    const { result } = renderHook(() => useDashboardParams())

    expect(result.current.dashboardId).toBeNull()
    expect(result.current.ready).toBe(false)
  })

  it('extracts dashboard parameters from currentDashboard', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })

    const { result } = renderHook(() => useDashboardParams())

    expect(result.current.dashboardId).toBe(1)
    expect(result.current.startDate).toBe('2024-12-01')
    expect(result.current.endDate).toBe('2024-12-31')
    expect(result.current.selectedYear).toBe(2024)
    expect(result.current.selectedMonth).toBe(12)
    expect(result.current.isMonthlyScale).toBe(true)
    expect(result.current.ready).toBe(true)
  })

  it('detects monthly scale for mtd range type', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-01-01', end_date: '2024-01-31' },
        date_range_type: 'mtd'
      }
    })

    const { result } = renderHook(() => useDashboardParams())

    expect(result.current.isMonthlyScale).toBe(true)
    expect(result.current.groupBy).toBe('week')
  })

  it('detects yearly scale for ytd range type', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-01-01', end_date: '2024-12-31' },
        date_range_type: 'ytd'
      }
    })

    const { result } = renderHook(() => useDashboardParams())

    expect(result.current.isMonthlyScale).toBe(false)
    expect(result.current.groupBy).toBe('month')
  })
})

describe('useSummaryData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('constructs monthly endpoint when isMonthlyScale=true', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useSummaryData())

    expect(mockUseSWR).toHaveBeenCalledWith(
      ['/api/v1/reports/monthly-summary?year=2024&month=12', 1],
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('constructs annual endpoint when isMonthlyScale=false', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-01-01', end_date: '2024-12-31' },
        date_range_type: 'ytd'
      }
    })
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useSummaryData())

    expect(mockUseSWR).toHaveBeenCalledWith(
      ['/api/v1/reports/annual-summary?year=2024', 1],
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('includes dashboardId in SWR key for cache isolation', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useSummaryData())

    const swrKey = mockUseSWR.mock.calls[0][0]
    expect(swrKey).toEqual(['/api/v1/reports/monthly-summary?year=2024&month=12', 1])
  })

  it('shows toast on error', async () => {
    mockUseSWR.mockReturnValue({ data: null, error: new Error('Test error'), isLoading: false, mutate: vi.fn() })

    renderHook(() => useSummaryData())

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to load summary data')
    })
  })

  it('returns null SWR key when not ready', () => {
    mockUseDashboard.mockReturnValue({ currentDashboard: null })
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useSummaryData())

    expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
  })
})

describe('useMonthOverMonthData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches only for monthly scale', () => {
    mockUseSWR.mockReturnValue({ data: { changes: {} }, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useMonthOverMonthData())

    expect(mockUseSWR).toHaveBeenCalledWith(
      ['/api/v1/reports/month-over-month?current_year=2024&current_month=12', 1],
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns null for yearly scale', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-01-01', end_date: '2024-12-31' },
        date_range_type: 'ytd'
      }
    })
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const { result } = renderHook(() => useMonthOverMonthData())

    expect(result.current.data).toBeNull()
  })
})

describe('useSpendingVelocityData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches only for monthly scale', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useSpendingVelocityData())

    expect(mockUseSWR).toHaveBeenCalledWith(
      ['/api/v1/reports/spending-velocity?year=2024&month=12', 1],
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('returns null for yearly scale', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-01-01', end_date: '2024-12-31' },
        date_range_type: 'ytd'
      }
    })
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const { result } = renderHook(() => useSpendingVelocityData())

    expect(result.current.data).toBeNull()
  })
})

describe('useAnomaliesData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('includes threshold parameter', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useAnomaliesData())

    expect(mockUseSWR).toHaveBeenCalledWith(
      ['/api/v1/reports/anomalies?year=2024&month=12&threshold=2.0', 1],
      expect.any(Function),
      expect.any(Object)
    )
  })
})

describe('useTrendsData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('includes filters in query string', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const filters = {
      buckets: ['groceries', 'dining'],
      accounts: ['checking'],
      merchants: ['amazon']
    }

    renderHook(() => useTrendsData(filters))

    const expectedUrl = '/api/v1/reports/trends?start_date=2024-12-01&end_date=2024-12-31&group_by=week&buckets=groceries%2Cdining&accounts=checking&merchants=amazon'
    expect(mockUseSWR).toHaveBeenCalledWith(
      [expectedUrl, 1],
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('works without filters', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useTrendsData())

    expect(mockUseSWR).toHaveBeenCalledWith(
      ['/api/v1/reports/trends?start_date=2024-12-01&end_date=2024-12-31&group_by=week', 1],
      expect.any(Function),
      expect.any(Object)
    )
  })
})

describe('useTopMerchantsData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('excludes merchant filter', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const filters = {
      buckets: ['groceries'],
      accounts: ['checking'],
      merchants: ['amazon'] // Should be excluded
    }

    renderHook(() => useTopMerchantsData(filters))

    const expectedUrl = '/api/v1/reports/top-merchants?limit=10&year=2024&month=12&buckets=groceries&accounts=checking'
    expect(mockUseSWR).toHaveBeenCalledWith(
      [expectedUrl, 1],
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('includes month param for monthly scale', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useTopMerchantsData())

    const swrKey = mockUseSWR.mock.calls[0][0]
    expect(swrKey[0]).toContain('month=12')
  })

  it('excludes month param for yearly scale', () => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-01-01', end_date: '2024-12-31' },
        date_range_type: 'ytd'
      }
    })
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    renderHook(() => useTopMerchantsData())

    const swrKey = mockUseSWR.mock.calls[0][0]
    expect(swrKey[0]).not.toContain('month=')
  })
})

describe('useSankeyData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('includes all filters', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const filters = {
      buckets: ['groceries'],
      accounts: ['checking'],
      merchants: ['amazon']
    }

    renderHook(() => useSankeyData(filters))

    const expectedUrl = '/api/v1/reports/sankey-flow?year=2024&month=12&buckets=groceries&accounts=checking&merchants=amazon'
    expect(mockUseSWR).toHaveBeenCalledWith(
      [expectedUrl, 1],
      expect.any(Function),
      expect.any(Object)
    )
  })
})

describe('useTreemapData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('includes all filters', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const filters = {
      buckets: ['dining'],
      accounts: ['credit'],
      merchants: ['restaurant']
    }

    renderHook(() => useTreemapData(filters))

    const expectedUrl = '/api/v1/reports/treemap?year=2024&month=12&buckets=dining&accounts=credit&merchants=restaurant'
    expect(mockUseSWR).toHaveBeenCalledWith(
      [expectedUrl, 1],
      expect.any(Function),
      expect.any(Object)
    )
  })
})

describe('useHeatmapData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('includes all filters', () => {
    mockUseSWR.mockReturnValue({ data: null, error: null, isLoading: false, mutate: vi.fn() })

    const filters = {
      buckets: ['entertainment'],
      accounts: ['savings'],
      merchants: ['netflix']
    }

    renderHook(() => useHeatmapData(filters))

    const expectedUrl = '/api/v1/reports/spending-heatmap?year=2024&month=12&buckets=entertainment&accounts=savings&merchants=netflix'
    expect(mockUseSWR).toHaveBeenCalledWith(
      [expectedUrl, 1],
      expect.any(Function),
      expect.any(Object)
    )
  })
})

describe('useBucketData', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      currentDashboard: {
        id: 1,
        date_range: { start_date: '2024-12-01', end_date: '2024-12-31' },
        date_range_type: 'mtd'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('derives bucket data from summary', () => {
    const mockSummary = {
      bucket_breakdown: {
        groceries: { amount: 500, count: 25 },
        dining: { amount: 300, count: 15 }
      }
    }

    mockUseSWR.mockReturnValue({ data: mockSummary, error: null, isLoading: false, mutate: vi.fn() })

    const { result } = renderHook(() => useBucketData())

    expect(result.current.bucketData).toEqual([
      { name: 'Groceries', value: 500, count: 25 },
      { name: 'Dining', value: 300, count: 15 }
    ])
  })

  it('returns empty array when no bucket breakdown', () => {
    mockUseSWR.mockReturnValue({ data: { bucket_breakdown: null }, error: null, isLoading: false, mutate: vi.fn() })

    const { result } = renderHook(() => useBucketData())

    expect(result.current.bucketData).toEqual([])
  })
})
