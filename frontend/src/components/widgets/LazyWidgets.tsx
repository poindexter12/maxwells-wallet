'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format'
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
  const { data: summary, isLoading: summaryLoading } = useSummaryData()
  const { data: monthOverMonth, isLoading: momLoading } = useMonthOverMonthData()

  if (summaryLoading || momLoading) {
    return <SummaryCardsSkeleton />
  }

  if (!summary) return null

  return <SummaryCards summary={summary} monthOverMonth={monthOverMonth} />
}

// Lazy Spending Velocity
export function LazySpendingVelocity({ widget: _widget }: { widget: Widget }) {
  const { data: summary, isLoading: summaryLoading } = useSummaryData()
  const { data: spendingVelocity, isLoading: velocityLoading } = useSpendingVelocityData()
  const { isMonthlyScale, selectedYear } = useDashboardParams()

  if (summaryLoading || velocityLoading) {
    return <StatsPanelSkeleton />
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
  const { data, isLoading } = useAnomaliesData()
  const { isMonthlyScale, selectedYear, selectedMonth } = useDashboardParams()

  if (isLoading) {
    return <StatsPanelSkeleton />
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
  const { data: topMerchants, isLoading: tmLoading } = useTopMerchantsData(filters)
  const { bucketData, isLoading: bucketLoading } = useBucketData()

  const isLoading = filters ? tmLoading : bucketLoading

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-64" />
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
  const { data, isLoading } = useTopMerchantsData(filters)

  if (isLoading) {
    return <WidgetSkeleton type="list" />
  }

  return <TopMerchantsList widget={widget} data={data ?? null} />
}

// Lazy Trends Chart
export function LazyTrendsChart({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading } = useTrendsData(filters)
  const { isMonthlyScale } = useDashboardParams()

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-[300px]" />
  }

  return <TrendsChart widget={widget} data={data ?? null} isMonthlyScale={isMonthlyScale} />
}

// Lazy Sankey Flow Chart
export function LazySankeyFlowChart({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading } = useSankeyData(filters)

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-[400px]" />
  }

  return <SankeyFlowChart widget={widget} data={data ?? null} />
}

// Lazy Spending Treemap
export function LazySpendingTreemap({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading } = useTreemapData(filters)

  if (isLoading) {
    return <WidgetSkeleton type="chart" height="h-[400px]" />
  }

  return <SpendingTreemap widget={widget} data={data ?? null} />
}

// Lazy Spending Heatmap
export function LazySpendingHeatmap({ widget }: { widget: Widget }) {
  const filters = parseFilters(widget.config)
  const { data, isLoading } = useHeatmapData(filters)
  const { isMonthlyScale, selectedYear, selectedMonth } = useDashboardParams()

  if (isLoading) {
    return <WidgetSkeleton type="heatmap" />
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
