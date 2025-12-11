// Shared types for dashboard widgets

export interface Widget {
  id: number
  widget_type: string
  position: number
  width: string
  is_visible: boolean
  config: string | null
}

export interface WidgetProps {
  widget?: Widget
  customData?: Record<string, unknown>
}

export interface SummaryData {
  total_income: number
  total_expenses: number
  net: number
  bucket_breakdown?: Record<string, { amount: number; count: number }>
  daily_average?: number
  days_elapsed?: number
  transaction_count?: number
}

export interface MonthOverMonthData {
  changes: {
    income: { amount: number; percent: number }
    expenses: { amount: number; percent: number }
    net: { amount: number; percent: number }
  }
}

export interface SpendingVelocityData {
  days_elapsed: number
  days_in_month: number
  pace: 'over_budget' | 'under_budget' | 'on_track'
  insights: {
    daily_burn_rate: string
    days_remaining: number
    projected_remaining_spending: number
  }
  projected_monthly: {
    expenses: number
  }
  previous_month: {
    expenses: number
  }
}

export interface AnomaliesData {
  summary: {
    total_anomalies: number
    large_transaction_count: number
    new_merchant_count: number
    unusual_bucket_count: number
    large_threshold_amount?: number
  }
  anomalies: {
    large_transactions: Array<{ amount: number; merchant: string; reason: string }>
    new_merchants: Array<{ amount: number; merchant: string; reason: string }>
    unusual_buckets: Array<{ bucket: string; reason: string }>
  }
}

export interface TrendsData {
  data: Array<{ period: string; income: number; expenses: number; net: number }>
  group_by: 'week' | 'month'
}

export interface TopMerchantsData {
  merchants: Array<{ merchant: string; amount: number }>
}

// Sankey chart data types
export interface SankeyNode {
  name: string
}

export interface SankeyLink {
  source: number
  target: number
  value: number
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

// Treemap data types
export interface TreemapChild {
  name: string
  value: number
  children?: TreemapChild[]
  // Index signature for Recharts Treemap compatibility
  [key: string]: string | number | TreemapChild[] | undefined
}

export interface TreemapData {
  data: {
    name: string
    children: TreemapChild[]
  }
}

// Heatmap data types
export interface HeatmapDay {
  day: number
  weekday: number
  amount: number
  count: number
  intensity: number
}

export interface HeatmapMonth {
  month: number
  month_name: string
  amount: number
  count: number
  intensity: number
}

export interface HeatmapSummary {
  total_spending: number
  max_daily: number
  max_monthly?: number
  days_with_spending: number
  months_with_spending?: number
}

export interface HeatmapData {
  days: (HeatmapDay | HeatmapMonth)[]
  summary: HeatmapSummary
}

// Chart color constants
export const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']

export const CHART_VARS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'
]

export const HEATMAP_VARS = [
  'var(--heatmap-0)', 'var(--heatmap-1)', 'var(--heatmap-2)',
  'var(--heatmap-3)', 'var(--heatmap-4)', 'var(--heatmap-5)'
]
