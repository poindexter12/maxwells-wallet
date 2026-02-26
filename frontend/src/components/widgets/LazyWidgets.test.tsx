import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TEST_IDS } from '@/test-ids'
import {
  LazySummaryCards,
  LazySpendingVelocity,
  LazyAnomaliesPanel,
  LazyBucketPieChart,
  LazyTopMerchantsList,
  LazyTrendsChart,
  LazySankeyFlowChart,
  LazySpendingTreemap,
  LazySpendingHeatmap,
} from './LazyWidgets'
import { Widget } from './types'

// --- Hook mocks ---

const mockSummaryRetry = vi.fn()
const mockMomRetry = vi.fn()
const mockVelocityRetry = vi.fn()
const mockAnomaliesRetry = vi.fn()
const mockTrendsRetry = vi.fn()
const mockTopMerchantsRetry = vi.fn()
const mockSankeyRetry = vi.fn()
const mockTreemapRetry = vi.fn()
const mockHeatmapRetry = vi.fn()

const hookDefaults = {
  data: null,
  isLoading: false,
  error: null,
  retry: vi.fn(),
}

const mockUseSummaryData = vi.fn(() => ({ ...hookDefaults, retry: mockSummaryRetry }))
const mockUseMonthOverMonthData = vi.fn(() => ({ ...hookDefaults, retry: mockMomRetry }))
const mockUseSpendingVelocityData = vi.fn(() => ({ ...hookDefaults, retry: mockVelocityRetry }))
const mockUseAnomaliesData = vi.fn(() => ({ ...hookDefaults, retry: mockAnomaliesRetry }))
const mockUseTrendsData = vi.fn(() => ({ ...hookDefaults, retry: mockTrendsRetry }))
const mockUseTopMerchantsData = vi.fn(() => ({ ...hookDefaults, retry: mockTopMerchantsRetry }))
const mockUseSankeyData = vi.fn(() => ({ ...hookDefaults, retry: mockSankeyRetry }))
const mockUseTreemapData = vi.fn(() => ({ ...hookDefaults, retry: mockTreemapRetry }))
const mockUseHeatmapData = vi.fn(() => ({ ...hookDefaults, retry: mockHeatmapRetry }))
const mockUseBucketData = vi.fn(() => ({ bucketData: [], isLoading: false }))
const mockUseDashboardParams = vi.fn(() => ({
  isMonthlyScale: true,
  selectedYear: 2026,
  selectedMonth: 2,
}))

vi.mock('@/hooks/useWidgetData', () => ({
  useSummaryData: (...args: unknown[]) => mockUseSummaryData(...args),
  useMonthOverMonthData: (...args: unknown[]) => mockUseMonthOverMonthData(...args),
  useSpendingVelocityData: (...args: unknown[]) => mockUseSpendingVelocityData(...args),
  useAnomaliesData: (...args: unknown[]) => mockUseAnomaliesData(...args),
  useTrendsData: (...args: unknown[]) => mockUseTrendsData(...args),
  useTopMerchantsData: (...args: unknown[]) => mockUseTopMerchantsData(...args),
  useSankeyData: (...args: unknown[]) => mockUseSankeyData(...args),
  useTreemapData: (...args: unknown[]) => mockUseTreemapData(...args),
  useHeatmapData: (...args: unknown[]) => mockUseHeatmapData(...args),
  useBucketData: () => mockUseBucketData(),
  useDashboardParams: () => mockUseDashboardParams(),
}))

// Mock child components so we test the lazy wrapper logic, not the chart rendering
vi.mock('./SummaryCards', () => ({
  SummaryCards: () => <div data-testid="mock-summary-cards">SummaryCards</div>,
}))
vi.mock('./SpendingVelocity', () => ({
  SpendingVelocity: () => <div data-testid="mock-spending-velocity">SpendingVelocity</div>,
}))
vi.mock('./AnomaliesPanel', () => ({
  AnomaliesPanel: () => <div data-testid="mock-anomalies-panel">AnomaliesPanel</div>,
}))
vi.mock('./BucketPieChart', () => ({
  BucketPieChart: () => <div data-testid="mock-bucket-pie-chart">BucketPieChart</div>,
}))
vi.mock('./TopMerchantsList', () => ({
  TopMerchantsList: () => <div data-testid="mock-top-merchants-list">TopMerchantsList</div>,
}))
vi.mock('./TrendsChart', () => ({
  TrendsChart: () => <div data-testid="mock-trends-chart">TrendsChart</div>,
}))
vi.mock('./SankeyFlowChart', () => ({
  SankeyFlowChart: () => <div data-testid="mock-sankey-flow-chart">SankeyFlowChart</div>,
}))
vi.mock('./SpendingTreemap', () => ({
  SpendingTreemap: () => <div data-testid="mock-spending-treemap">SpendingTreemap</div>,
}))
vi.mock('./SpendingHeatmap', () => ({
  SpendingHeatmap: () => <div data-testid="mock-spending-heatmap">SpendingHeatmap</div>,
}))
vi.mock('./WidgetSkeleton', () => ({
  WidgetSkeleton: ({ type }: { type: string }) => <div data-testid={`mock-skeleton-${type}`}>Skeleton</div>,
  SummaryCardsSkeleton: () => <div data-testid="mock-summary-skeleton">SummarySkeleton</div>,
  StatsPanelSkeleton: () => <div data-testid="mock-stats-skeleton">StatsSkeleton</div>,
}))

vi.mock('@/hooks/useFormat', () => ({
  useFormat: () => ({
    formatCurrency: (v: number) => `$${v}`,
    getDefaultLargeThreshold: () => 100,
  }),
}))

const makeWidget = (config: string | null = null): Widget => ({
  id: 1,
  widget_type: 'test',
  position: 0,
  width: 'full',
  is_visible: true,
  config,
})

beforeEach(() => {
  vi.clearAllMocks()
  // Reset to safe defaults
  mockUseSummaryData.mockReturnValue({ ...hookDefaults, retry: mockSummaryRetry })
  mockUseMonthOverMonthData.mockReturnValue({ ...hookDefaults, retry: mockMomRetry })
  mockUseSpendingVelocityData.mockReturnValue({ ...hookDefaults, retry: mockVelocityRetry })
  mockUseAnomaliesData.mockReturnValue({ ...hookDefaults, retry: mockAnomaliesRetry })
  mockUseTrendsData.mockReturnValue({ ...hookDefaults, retry: mockTrendsRetry })
  mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, retry: mockTopMerchantsRetry })
  mockUseSankeyData.mockReturnValue({ ...hookDefaults, retry: mockSankeyRetry })
  mockUseTreemapData.mockReturnValue({ ...hookDefaults, retry: mockTreemapRetry })
  mockUseHeatmapData.mockReturnValue({ ...hookDefaults, retry: mockHeatmapRetry })
  mockUseBucketData.mockReturnValue({ bucketData: [], isLoading: false })
  mockUseDashboardParams.mockReturnValue({ isMonthlyScale: true, selectedYear: 2026, selectedMonth: 2 })
})

// --- parseFilters (tested indirectly via components that use widget.config) ---

describe('parseFilters (via LazyTopMerchantsList)', () => {
  it('passes undefined filters when config is null', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [] }, retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget(null)} />)
    expect(mockUseTopMerchantsData).toHaveBeenCalledWith(undefined)
  })

  it('passes undefined filters for empty JSON object', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [] }, retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget('{}')} />)
    expect(mockUseTopMerchantsData).toHaveBeenCalledWith(undefined)
  })

  it('passes filters when config has buckets', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [] }, retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget('{"buckets":["groceries"]}')} />)
    expect(mockUseTopMerchantsData).toHaveBeenCalledWith({
      buckets: ['groceries'],
      accounts: undefined,
      merchants: undefined,
    })
  })

  it('passes undefined filters for malformed JSON', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [] }, retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget('not-json')} />)
    expect(mockUseTopMerchantsData).toHaveBeenCalledWith(undefined)
  })

  it('passes filters when config has accounts and merchants', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [] }, retry: mockTopMerchantsRetry })
    const config = JSON.stringify({ accounts: ['chase'], merchants: ['amazon'] })
    render(<LazyTopMerchantsList widget={makeWidget(config)} />)
    expect(mockUseTopMerchantsData).toHaveBeenCalledWith({
      buckets: undefined,
      accounts: ['chase'],
      merchants: ['amazon'],
    })
  })
})

// --- Loading → Skeleton ---

describe('loading states', () => {
  it('LazySummaryCards shows skeleton when loading', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockSummaryRetry })
    render(<LazySummaryCards />)
    expect(screen.getByTestId('mock-summary-skeleton')).toBeInTheDocument()
  })

  it('LazySummaryCards shows skeleton when MoM is loading', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, retry: mockSummaryRetry })
    mockUseMonthOverMonthData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockMomRetry })
    render(<LazySummaryCards />)
    expect(screen.getByTestId('mock-summary-skeleton')).toBeInTheDocument()
  })

  it('LazySpendingVelocity shows stats skeleton when loading', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockSummaryRetry })
    render(<LazySpendingVelocity widget={makeWidget()} />)
    expect(screen.getByTestId('mock-stats-skeleton')).toBeInTheDocument()
  })

  it('LazyAnomaliesPanel shows stats skeleton when loading', () => {
    mockUseAnomaliesData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockAnomaliesRetry })
    render(<LazyAnomaliesPanel widget={makeWidget()} />)
    expect(screen.getByTestId('mock-stats-skeleton')).toBeInTheDocument()
  })

  it('LazyTrendsChart shows chart skeleton when loading', () => {
    mockUseTrendsData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockTrendsRetry })
    render(<LazyTrendsChart widget={makeWidget()} />)
    expect(screen.getByTestId('mock-skeleton-chart')).toBeInTheDocument()
  })

  it('LazyTopMerchantsList shows list skeleton when loading', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget()} />)
    expect(screen.getByTestId('mock-skeleton-list')).toBeInTheDocument()
  })

  it('LazySankeyFlowChart shows chart skeleton when loading', () => {
    mockUseSankeyData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockSankeyRetry })
    render(<LazySankeyFlowChart widget={makeWidget()} />)
    expect(screen.getByTestId('mock-skeleton-chart')).toBeInTheDocument()
  })

  it('LazySpendingTreemap shows chart skeleton when loading', () => {
    mockUseTreemapData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockTreemapRetry })
    render(<LazySpendingTreemap widget={makeWidget()} />)
    expect(screen.getByTestId('mock-skeleton-chart')).toBeInTheDocument()
  })

  it('LazySpendingHeatmap shows heatmap skeleton when loading', () => {
    mockUseHeatmapData.mockReturnValue({ ...hookDefaults, isLoading: true, retry: mockHeatmapRetry })
    render(<LazySpendingHeatmap widget={makeWidget()} />)
    expect(screen.getByTestId('mock-skeleton-heatmap')).toBeInTheDocument()
  })
})

// --- Error → WidgetError with retry ---

describe('error states and retry', () => {
  it('LazySummaryCards shows error and retry calls summaryRetry', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockSummaryRetry })
    render(<LazySummaryCards />)
    expect(screen.getByTestId(TEST_IDS.WIDGET_ERROR)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockSummaryRetry).toHaveBeenCalled()
  })

  it('LazySummaryCards shows error when MoM fails (summary ok)', () => {
    const summary = { total_income: 1000, total_expenses: 500, net: 500 }
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, data: summary, retry: mockSummaryRetry })
    mockUseMonthOverMonthData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockMomRetry })
    render(<LazySummaryCards />)
    expect(screen.getByTestId(TEST_IDS.WIDGET_ERROR)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockMomRetry).toHaveBeenCalled()
  })

  it('LazySpendingVelocity retry calls velocityRetry on velocity error', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, data: { net: 0 }, retry: mockSummaryRetry })
    mockUseSpendingVelocityData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockVelocityRetry })
    render(<LazySpendingVelocity widget={makeWidget()} />)
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockVelocityRetry).toHaveBeenCalled()
  })

  it('LazyTrendsChart retry calls trendsRetry', () => {
    mockUseTrendsData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockTrendsRetry })
    render(<LazyTrendsChart widget={makeWidget()} />)
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockTrendsRetry).toHaveBeenCalled()
  })

  it('LazyTopMerchantsList retry calls topMerchantsRetry', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget()} />)
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockTopMerchantsRetry).toHaveBeenCalled()
  })

  it('LazySankeyFlowChart retry calls sankeyRetry', () => {
    mockUseSankeyData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockSankeyRetry })
    render(<LazySankeyFlowChart widget={makeWidget()} />)
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockSankeyRetry).toHaveBeenCalled()
  })

  it('LazySpendingTreemap retry calls treemapRetry', () => {
    mockUseTreemapData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockTreemapRetry })
    render(<LazySpendingTreemap widget={makeWidget()} />)
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockTreemapRetry).toHaveBeenCalled()
  })

  it('LazySpendingHeatmap retry calls heatmapRetry', () => {
    mockUseHeatmapData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockHeatmapRetry })
    render(<LazySpendingHeatmap widget={makeWidget()} />)
    fireEvent.click(screen.getByTestId(TEST_IDS.WIDGET_ERROR_RETRY))
    expect(mockHeatmapRetry).toHaveBeenCalled()
  })
})

// --- Success → renders child widget ---

describe('success states', () => {
  it('LazySummaryCards renders SummaryCards with data', () => {
    const summary = { total_income: 5000, total_expenses: 3000, net: 2000 }
    const mom = { changes: { income: { amount: 100, percent: 5 }, expenses: { amount: -50, percent: -2 }, net: { amount: 150, percent: 8 } } }
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, data: summary, retry: mockSummaryRetry })
    mockUseMonthOverMonthData.mockReturnValue({ ...hookDefaults, data: mom, retry: mockMomRetry })
    render(<LazySummaryCards />)
    expect(screen.getByTestId('mock-summary-cards')).toBeInTheDocument()
  })

  it('LazySummaryCards returns null when summary data is null', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, data: null, retry: mockSummaryRetry })
    mockUseMonthOverMonthData.mockReturnValue({ ...hookDefaults, data: null, retry: mockMomRetry })
    const { container } = render(<LazySummaryCards />)
    expect(container.innerHTML).toBe('')
  })

  it('LazySpendingVelocity renders with data', () => {
    const summary = { total_income: 5000, total_expenses: 3000, net: 2000 }
    const velocity = { days_elapsed: 15, days_in_month: 28, pace: 'on_track' as const }
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, data: summary, retry: mockSummaryRetry })
    mockUseSpendingVelocityData.mockReturnValue({ ...hookDefaults, data: velocity, retry: mockVelocityRetry })
    render(<LazySpendingVelocity widget={makeWidget()} />)
    expect(screen.getByTestId('mock-spending-velocity')).toBeInTheDocument()
  })

  it('LazySpendingVelocity returns null when summary is null', () => {
    mockUseSummaryData.mockReturnValue({ ...hookDefaults, data: null, retry: mockSummaryRetry })
    mockUseSpendingVelocityData.mockReturnValue({ ...hookDefaults, data: {}, retry: mockVelocityRetry })
    const { container } = render(<LazySpendingVelocity widget={makeWidget()} />)
    expect(container.innerHTML).toBe('')
  })

  it('LazyTrendsChart renders with data', () => {
    mockUseTrendsData.mockReturnValue({ ...hookDefaults, data: { data: [], group_by: 'week' }, retry: mockTrendsRetry })
    render(<LazyTrendsChart widget={makeWidget()} />)
    expect(screen.getByTestId('mock-trends-chart')).toBeInTheDocument()
  })

  it('LazyTopMerchantsList renders with data', () => {
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [{ merchant: 'Amazon', amount: 100 }] }, retry: mockTopMerchantsRetry })
    render(<LazyTopMerchantsList widget={makeWidget()} />)
    expect(screen.getByTestId('mock-top-merchants-list')).toBeInTheDocument()
  })

  it('LazySankeyFlowChart renders with data', () => {
    mockUseSankeyData.mockReturnValue({ ...hookDefaults, data: { nodes: [], links: [] }, retry: mockSankeyRetry })
    render(<LazySankeyFlowChart widget={makeWidget()} />)
    expect(screen.getByTestId('mock-sankey-flow-chart')).toBeInTheDocument()
  })

  it('LazySpendingTreemap renders with data', () => {
    mockUseTreemapData.mockReturnValue({ ...hookDefaults, data: { data: { name: 'root', children: [] } }, retry: mockTreemapRetry })
    render(<LazySpendingTreemap widget={makeWidget()} />)
    expect(screen.getByTestId('mock-spending-treemap')).toBeInTheDocument()
  })

  it('LazySpendingHeatmap renders with data', () => {
    mockUseHeatmapData.mockReturnValue({ ...hookDefaults, data: { days: [], summary: { total_spending: 0, max_daily: 0, days_with_spending: 0 } }, retry: mockHeatmapRetry })
    render(<LazySpendingHeatmap widget={makeWidget()} />)
    expect(screen.getByTestId('mock-spending-heatmap')).toBeInTheDocument()
  })
})

// --- Conditional logic branches ---

describe('conditional rendering', () => {
  it('LazyAnomaliesPanel returns null when not monthly scale', () => {
    mockUseDashboardParams.mockReturnValue({ isMonthlyScale: false, selectedYear: 2026, selectedMonth: 2 })
    mockUseAnomaliesData.mockReturnValue({ ...hookDefaults, data: { summary: {}, anomalies: {} }, retry: mockAnomaliesRetry })
    const { container } = render(<LazyAnomaliesPanel widget={makeWidget()} />)
    expect(container.innerHTML).toBe('')
  })

  it('LazyAnomaliesPanel returns null when data is null', () => {
    mockUseAnomaliesData.mockReturnValue({ ...hookDefaults, data: null, retry: mockAnomaliesRetry })
    const { container } = render(<LazyAnomaliesPanel widget={makeWidget()} />)
    expect(container.innerHTML).toBe('')
  })

  it('LazyAnomaliesPanel renders when monthly scale and data present', () => {
    mockUseAnomaliesData.mockReturnValue({ ...hookDefaults, data: { summary: {}, anomalies: {} }, retry: mockAnomaliesRetry })
    render(<LazyAnomaliesPanel widget={makeWidget()} />)
    expect(screen.getByTestId('mock-anomalies-panel')).toBeInTheDocument()
  })

  it('LazyBucketPieChart uses bucket data when no config filters', () => {
    mockUseBucketData.mockReturnValue({ bucketData: [{ name: 'Food', value: 500, count: 10 }], isLoading: false })
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, data: { merchants: [] }, retry: mockTopMerchantsRetry })
    render(<LazyBucketPieChart widget={makeWidget(null)} />)
    expect(screen.getByTestId('mock-bucket-pie-chart')).toBeInTheDocument()
  })

  it('LazyBucketPieChart uses filtered merchant data when config has filters', () => {
    const config = JSON.stringify({ buckets: ['groceries'] })
    mockUseTopMerchantsData.mockReturnValue({
      ...hookDefaults,
      data: { merchants: [{ merchant: 'Walmart', amount: -200 }] },
      retry: mockTopMerchantsRetry,
    })
    render(<LazyBucketPieChart widget={makeWidget(config)} />)
    expect(screen.getByTestId('mock-bucket-pie-chart')).toBeInTheDocument()
  })

  it('LazyBucketPieChart shows error when filtered and topMerchants fails', () => {
    const config = JSON.stringify({ buckets: ['groceries'] })
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, error: new Error('fail'), retry: mockTopMerchantsRetry })
    render(<LazyBucketPieChart widget={makeWidget(config)} />)
    expect(screen.getByTestId(TEST_IDS.WIDGET_ERROR)).toBeInTheDocument()
  })

  it('LazyBucketPieChart shows skeleton when bucket data is loading (unfiltered)', () => {
    mockUseBucketData.mockReturnValue({ bucketData: [], isLoading: true })
    mockUseTopMerchantsData.mockReturnValue({ ...hookDefaults, retry: mockTopMerchantsRetry })
    render(<LazyBucketPieChart widget={makeWidget(null)} />)
    expect(screen.getByTestId('mock-skeleton-chart')).toBeInTheDocument()
  })
})
