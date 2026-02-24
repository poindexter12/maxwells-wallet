'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { useDashboard } from '@/contexts/DashboardContext'
import {
  SummaryData,
  MonthOverMonthData,
  SpendingVelocityData,
  AnomaliesData,
  TrendsData,
  TopMerchantsData,
  SankeyData,
  TreemapData,
  HeatmapData
} from '@/components/widgets/types'

// Global fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

// Widget filter configuration
export interface WidgetFilters {
  buckets?: string[]
  accounts?: string[]
  merchants?: string[]
}

// Hook to get dashboard parameters for API calls
export function useDashboardParams() {
  const { currentDashboard } = useDashboard()

  if (!currentDashboard) {
    return {
      startDate: '',
      endDate: '',
      selectedYear: new Date().getFullYear(),
      selectedMonth: new Date().getMonth() + 1,
      isMonthlyScale: true,
      groupBy: 'week' as const,
      ready: false
    }
  }

  const startDate = currentDashboard.date_range?.start_date || ''
  const endDate = currentDashboard.date_range?.end_date || ''
  const now = new Date()
  const parsedYear = endDate ? parseInt(endDate.split('-')[0]) : NaN
  const parsedMonth = endDate ? parseInt(endDate.split('-')[1]) : NaN
  const selectedYear = !isNaN(parsedYear) ? parsedYear : now.getFullYear()
  const selectedMonth = !isNaN(parsedMonth) ? parsedMonth : now.getMonth() + 1

  const rangeType = currentDashboard.date_range_type
  const isMonthlyScale = rangeType === 'mtd' || rangeType === 'last_30_days'
  const isYearlyScale = rangeType === 'ytd' || rangeType === 'last_year' || rangeType === 'last_90_days'
  const groupBy = isYearlyScale ? 'month' : 'week'

  return {
    startDate,
    endDate,
    selectedYear,
    selectedMonth,
    isMonthlyScale,
    groupBy,
    ready: Boolean(startDate && endDate)
  }
}

// Build filter query string
function buildFilterQuery(filters?: WidgetFilters, excludeMerchants = false): string {
  if (!filters) return ''
  const params: string[] = []
  if (filters.buckets?.length) params.push(`buckets=${encodeURIComponent(filters.buckets.join(','))}`)
  if (filters.accounts?.length) params.push(`accounts=${encodeURIComponent(filters.accounts.join(','))}`)
  if (!excludeMerchants && filters.merchants?.length) params.push(`merchants=${encodeURIComponent(filters.merchants.join(','))}`)
  return params.length > 0 ? `&${params.join('&')}` : ''
}

// Summary data hook (monthly or annual)
export function useSummaryData() {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()

  const endpoint = isMonthlyScale
    ? `/api/v1/reports/monthly-summary?year=${selectedYear}&month=${selectedMonth}`
    : `/api/v1/reports/annual-summary?year=${selectedYear}`

  const { data, error, isLoading, mutate } = useSWR<SummaryData>(
    ready ? endpoint : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load summary data')
    }
  }, [error])

  return { data, error, isLoading, retry: mutate }
}

// Month-over-month data hook
export function useMonthOverMonthData() {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()

  const { data, error, isLoading, mutate } = useSWR<MonthOverMonthData>(
    ready && isMonthlyScale
      ? `/api/v1/reports/month-over-month?current_year=${selectedYear}&current_month=${selectedMonth}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load month-over-month data')
    }
  }, [error])

  return { data: isMonthlyScale ? data : null, error, isLoading, retry: mutate }
}

// Spending velocity data hook
export function useSpendingVelocityData() {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()

  const { data, error, isLoading, mutate } = useSWR<SpendingVelocityData>(
    ready && isMonthlyScale
      ? `/api/v1/reports/spending-velocity?year=${selectedYear}&month=${selectedMonth}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load spending velocity data')
    }
  }, [error])

  return { data: isMonthlyScale ? data : null, error, isLoading, retry: mutate }
}

// Anomalies data hook
export function useAnomaliesData() {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()

  const { data, error, isLoading, mutate } = useSWR<AnomaliesData>(
    ready && isMonthlyScale
      ? `/api/v1/reports/anomalies?year=${selectedYear}&month=${selectedMonth}&threshold=2.0`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load anomalies data')
    }
  }, [error])

  return { data: isMonthlyScale ? data : null, error, isLoading, retry: mutate }
}

// Trends data hook
export function useTrendsData(filters?: WidgetFilters) {
  const { startDate, endDate, groupBy, ready } = useDashboardParams()
  const filterQuery = buildFilterQuery(filters)

  const { data, error, isLoading, mutate } = useSWR<TrendsData>(
    ready
      ? `/api/v1/reports/trends?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}${filterQuery}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load trends data')
    }
  }, [error])

  return { data, error, isLoading, retry: mutate }
}

// Top merchants data hook
export function useTopMerchantsData(filters?: WidgetFilters) {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()
  const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''
  // Don't filter by merchants for top merchants (that doesn't make sense)
  const filterQuery = buildFilterQuery(filters, true)

  const { data, error, isLoading, mutate } = useSWR<TopMerchantsData>(
    ready
      ? `/api/v1/reports/top-merchants?limit=10&year=${selectedYear}${monthParam}${filterQuery}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load top merchants data')
    }
  }, [error])

  return { data, error, isLoading, retry: mutate }
}

// Sankey flow data hook
export function useSankeyData(filters?: WidgetFilters) {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()
  const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''
  const filterQuery = buildFilterQuery(filters)

  const { data, error, isLoading, mutate } = useSWR<SankeyData>(
    ready
      ? `/api/v1/reports/sankey-flow?year=${selectedYear}${monthParam}${filterQuery}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load sankey flow data')
    }
  }, [error])

  return { data, error, isLoading, retry: mutate }
}

// Treemap data hook
export function useTreemapData(filters?: WidgetFilters) {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()
  const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''
  const filterQuery = buildFilterQuery(filters)

  const { data, error, isLoading, mutate } = useSWR<TreemapData>(
    ready
      ? `/api/v1/reports/treemap?year=${selectedYear}${monthParam}${filterQuery}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load treemap data')
    }
  }, [error])

  return { data, error, isLoading, retry: mutate }
}

// Heatmap data hook
export function useHeatmapData(filters?: WidgetFilters) {
  const { selectedYear, selectedMonth, isMonthlyScale, ready } = useDashboardParams()
  const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''
  const filterQuery = buildFilterQuery(filters)

  const { data, error, isLoading, mutate } = useSWR<HeatmapData>(
    ready
      ? `/api/v1/reports/spending-heatmap?year=${selectedYear}${monthParam}${filterQuery}`
      : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    if (error) {
      toast.error('Failed to load heatmap data')
    }
  }, [error])

  return { data, error, isLoading, retry: mutate }
}

// Bucket data derived from summary
export function useBucketData() {
  const { data: summary, isLoading } = useSummaryData()

  const bucketData = summary?.bucket_breakdown
    ? Object.entries(summary.bucket_breakdown).map(([name, data]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: data.amount,
        count: data.count
      }))
    : []

  return { bucketData, isLoading }
}
