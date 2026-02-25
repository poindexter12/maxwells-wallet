'use client'

import { Widget } from './types'
import {
  useSummaryData,
  useMonthOverMonthData,
  useSpendingVelocityData,
  useAnomaliesData,
  useTrendsData,
  useTopMerchantsData,
  useSankeyData,
  useTreemapData,
  useHeatmapData,
  useBucketData,
  useDashboardParams,
  WidgetFilters
} from '@/hooks/useWidgetData'
import { TEST_IDS } from '@/test-ids'
import { WidgetSkeleton, SummaryCardsSkeleton, StatsPanelSkeleton } from './WidgetSkeleton'
import { SummaryCards } from './SummaryCards'
import { SpendingVelocity } from './SpendingVelocity'
import { AnomaliesPanel } from './AnomaliesPanel'
import { BucketPieChart } from './BucketPieChart'
import { TopMerchantsList } from './TopMerchantsList'
import { TrendsChart } from './TrendsChart'
import { SankeyFlowChart } from './SankeyFlowChart'
import { SpendingTreemap } from './SpendingTreemap'
import { SpendingHeatmap } from './SpendingHeatmap'

// Error component for widgets
function WidgetError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
      data-testid={TEST_IDS.WIDGET_ERROR}
    >
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-red-800 dark:text-red-200">Failed to load widget data</p>
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          data-testid={TEST_IDS.WIDGET_ERROR_RETRY}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// Parse widget config to get filters
function parseFilters(config: string | null): WidgetFilters | undefined {
  if (!config) return undefined
  try {
    const parsed = JSON.parse(config)
    if (parsed.buckets?.length || parsed.accounts?.length || parsed.merchants?.length) {
      return {
        buckets: parsed.buckets,
        accounts: parsed.accounts,
        merchants: parsed.merchants
      }
    }
  } catch {
    // Ignore parse errors
  }
  return undefined
}

// Lazy Summary Cards
export function LazySummaryCards() {
  const { data: summary, isLoading: summaryLoading, error: summaryError, retry: summaryRetry } = useSummaryData()
  const { data: monthOverMonth, isLoading: momLoading, error: momError, retry: momRetry } = useMonthOverMonthData()

  if (summaryLoading || momLoading) {
    return <SummaryCardsSkeleton />
  }

  if (summaryError) {
    return <WidgetError onRetry={() => summaryRetry()} />
  }

  if (momError) {
    return <WidgetError onRetry={() => momRetry()} />
  }

  if (!summary) return null

  return <SummaryCards summary={summary} monthOverMonth={monthOverMonth} />
}

// Lazy Spending Velocity
export function LazySpendingVelocity({ widget: _widget }: { widget: Widget }) {
  const { data: summary, isLoading: summaryLoading, error: summaryError, retry: summaryRetry } = useSummaryData()
  const { data: spendingVelocity, isLoading: velocityLoading, error: velocityError, retry: velocityRetry } = useSpendingVelocityData()
  const { isMonthlyScale, selectedYear } = useDashboardParams()

  if (summaryLoading || velocityLoading) {
    return <StatsPanelSkeleton />
  }

  if (summaryError) {
    return <WidgetError onRetry={() => summaryRetry()} />
  }

  if (velocityError) {
    return <WidgetError onRetry={() => velocityRetry()} />
  }

  if (!summary) return null

  return (
    <SpendingVelocity
      isMonthlyScale={isMonthlyScale}
      summary={summary}
      spendingVelocity={spendingVelocity}
      selectedYear={selectedYear}
    />
  )
}

// Lazy Anomalies Panel
export function LazyAnomaliesPanel({ widget: _widget }: { widget: Widget }) {
  const { data, isLoading, error, retry } = useAnomaliesData()
  const { isMonthlyScale, selectedYear, selectedMonth } = useDashboardParams()

  if (isLoading) {
    return <StatsPanelSkeleton />
  }

  if (error) {
    return <WidgetError onRetry={() => retry()} />
  }

  if (!isMonthlyScale || !data) return null

  return (
    <AnomaliesPanel
      anomalies={data}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
    />
  )
}

// Lazy Bucket Pie Chart
export function LazyBucketPieChart({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  // If filtered, use top merchants data (which gives bucket breakdown)
  const { data: topMerchants, isLoading: tmLoading, error: tmError, retry: tmRetry } = useTopMerchantsData(filters)
  const { bucketData, isLoading: bucketLoading } = useBucketData()

  const isLoading = filters ? tmLoading : bucketLoading

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-64" />
  }

  if (filters && tmError) {
    return <WidgetError onRetry={() => tmRetry()} />
  }

  // Use filtered data or default bucket data
  const finalBucketData = filters && topMerchants
    ? topMerchants.merchants.map(m => ({
        name: m.merchant,
        value: Math.abs(m.amount),
        count: 1
      }))
    : bucketData

  return <BucketPieChart widget={widget} bucketData={finalBucketData} />
}

// Lazy Top Merchants List
export function LazyTopMerchantsList({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading, error, retry } = useTopMerchantsData(filters)

  if (isLoading) {
    return <WidgetSkeleton type="list" />
  }

  if (error) {
    return <WidgetError onRetry={() => retry()} />
  }

  return <TopMerchantsList widget={widget} data={data ?? null} />
}

// Lazy Trends Chart
export function LazyTrendsChart({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading, error, retry } = useTrendsData(filters)
  const { isMonthlyScale } = useDashboardParams()

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-[300px]" />
  }

  if (error) {
    return <WidgetError onRetry={() => retry()} />
  }

  return <TrendsChart widget={widget} data={data ?? null} isMonthlyScale={isMonthlyScale} />
}

// Lazy Sankey Flow Chart
export function LazySankeyFlowChart({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading, error, retry } = useSankeyData(filters)

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-[400px]" />
  }

  if (error) {
    return <WidgetError onRetry={() => retry()} />
  }

  return <SankeyFlowChart widget={widget} data={data ?? null} />
}

// Lazy Spending Treemap
export function LazySpendingTreemap({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading, error, retry } = useTreemapData(filters)

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-[400px]" />
  }

  if (error) {
    return <WidgetError onRetry={() => retry()} />
  }

  return <SpendingTreemap widget={widget} data={data ?? null} />
}

// Lazy Spending Heatmap
export function LazySpendingHeatmap({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading, error, retry } = useHeatmapData(filters)
  const { isMonthlyScale, selectedYear, selectedMonth } = useDashboardParams()

  if (isLoading) {
    return <WidgetSkeleton type="heatmap" />
  }

  if (error) {
    return <WidgetError onRetry={() => retry()} />
  }

  return (
    <SpendingHeatmap
      widget={widget}
      data={data ?? null}
      isMonthlyScale={isMonthlyScale}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
    />
  )
}
