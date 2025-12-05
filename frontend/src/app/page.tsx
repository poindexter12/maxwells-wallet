'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Sankey, Treemap } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'
import { DashboardConfig } from '@/components/DashboardConfig'
import DashboardTabs from '@/components/DashboardTabs'
import { useDashboard, DateRangeType } from '@/contexts/DashboardContext'

const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
  { value: 'mtd', label: 'Month to Date' },
  { value: 'qtd', label: 'Quarter to Date' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_year', label: 'Last Year' },
]

// Fallback colors if CSS variables aren't available
const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']

// CSS variable names for chart colors (used directly in styles for theme reactivity)
const CHART_VARS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)'
]
const HEATMAP_VARS = [
  'var(--heatmap-0)', 'var(--heatmap-1)', 'var(--heatmap-2)',
  'var(--heatmap-3)', 'var(--heatmap-4)', 'var(--heatmap-5)'
]

interface Widget {
  id: number
  widget_type: string
  title: string | null
  position: number
  width: string
  is_visible: boolean
  config: string | null
}

export default function Dashboard() {
  const { currentDashboard, loading: dashboardLoading, updateDashboard } = useDashboard()
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [topMerchants, setTopMerchants] = useState<any>(null)
  const [monthOverMonth, setMonthOverMonth] = useState<any>(null)
  const [spendingVelocity, setSpendingVelocity] = useState<any>(null)
  const [anomalies, setAnomalies] = useState<any>(null)
  const [sankeyData, setSankeyData] = useState<any>(null)
  const [treemapData, setTreemapData] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [availableBuckets, setAvailableBuckets] = useState<{ id: number; value: string }[]>([])
  // Per-widget data for widgets with bucket filters
  const [widgetData, setWidgetData] = useState<Record<number, any>>({})

  // Extract date info from current dashboard
  const startDate = currentDashboard?.date_range?.start_date || ''
  const endDate = currentDashboard?.date_range?.end_date || ''
  // Parse year/month from end date for APIs that still use them
  const selectedYear = endDate ? parseInt(endDate.split('-')[0]) : new Date().getFullYear()
  const selectedMonth = endDate ? parseInt(endDate.split('-')[1]) : new Date().getMonth() + 1

  // Fetch widget configuration and bucket tags
  useEffect(() => {
    if (currentDashboard) {
      fetchWidgets()
      fetchBuckets()
    }
  }, [currentDashboard?.id])

  async function fetchBuckets() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      if (res.ok) {
        const data = await res.json()
        setAvailableBuckets(data)
      }
    } catch (error) {
      console.error('Error fetching buckets:', error)
    }
  }

  async function fetchWidgets() {
    try {
      const res = await fetch('/api/v1/dashboard/widgets')
      if (res.ok) {
        const data = await res.json()
        setWidgets(data)
      }
    } catch (error) {
      console.error('Error fetching widgets:', error)
    }
  }

  async function handleToggleVisibility(widgetId: number) {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}/visibility`, {
        method: 'PATCH'
      })
      fetchWidgets()
    } catch (error) {
      console.error('Error toggling visibility:', error)
    }
  }

  async function handleMoveUp(widgetId: number) {
    const sorted = [...widgets].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex(w => w.id === widgetId)
    if (index <= 0) return

    // Swap positions with the widget above
    const updates = [
      { id: sorted[index].id, position: sorted[index - 1].position },
      { id: sorted[index - 1].id, position: sorted[index].position }
    ]

    try {
      await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      })
      fetchWidgets()
    } catch (error) {
      console.error('Error reordering:', error)
    }
  }

  async function handleMoveDown(widgetId: number) {
    const sorted = [...widgets].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex(w => w.id === widgetId)
    if (index < 0 || index >= sorted.length - 1) return

    // Swap positions with the widget below
    const updates = [
      { id: sorted[index].id, position: sorted[index + 1].position },
      { id: sorted[index + 1].id, position: sorted[index].position }
    ]

    try {
      await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      })
      fetchWidgets()
    } catch (error) {
      console.error('Error reordering:', error)
    }
  }

  async function handleReset() {
    try {
      await fetch('/api/v1/dashboard/reset', { method: 'POST' })
      fetchWidgets()
    } catch (error) {
      console.error('Error resetting:', error)
    }
  }

  async function handleDuplicate(widgetId: number) {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}/duplicate`, { method: 'POST' })
      fetchWidgets()
    } catch (error) {
      console.error('Error duplicating widget:', error)
    }
  }

  async function handleUpdateWidget(widgetId: number, title: string, config: { buckets?: string[] }) {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          config: Object.keys(config).length > 0 ? JSON.stringify(config) : null
        })
      })
      fetchWidgets()
    } catch (error) {
      console.error('Error updating widget:', error)
    }
  }

  async function handleDeleteWidget(widgetId: number) {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}`, { method: 'DELETE' })
      fetchWidgets()
    } catch (error) {
      console.error('Error deleting widget:', error)
    }
  }

  async function handleDateRangeChange(dateRangeType: DateRangeType) {
    if (!currentDashboard) return
    await updateDashboard(currentDashboard.id, { date_range_type: dateRangeType })
  }

  useEffect(() => {
    async function fetchData() {
      if (!currentDashboard || !startDate || !endDate) return

      setLoading(true)
      try {
        // Determine if this is a monthly-scale or yearly-scale view based on date range type
        const rangeType = currentDashboard.date_range_type
        const isMonthlyScale = rangeType === 'mtd' || rangeType === 'last_30_days'
        const isYearlyScale = rangeType === 'ytd' || rangeType === 'last_year' || rangeType === 'last_90_days'
        const groupBy = isYearlyScale ? 'month' : 'week'

        // Fetch summary based on date range
        if (isMonthlyScale) {
          const summaryRes = await fetch(`/api/v1/reports/monthly-summary?year=${selectedYear}&month=${selectedMonth}`)
          const summaryData = await summaryRes.json()
          setSummary(summaryData)

          // Fetch month-over-month comparison
          const momRes = await fetch(`/api/v1/reports/month-over-month?current_year=${selectedYear}&current_month=${selectedMonth}`)
          const momData = await momRes.json()
          setMonthOverMonth(momData)

          // Fetch spending velocity
          const velocityRes = await fetch(`/api/v1/reports/spending-velocity?year=${selectedYear}&month=${selectedMonth}`)
          const velocityData = await velocityRes.json()
          setSpendingVelocity(velocityData)

          // Fetch anomalies
          const anomaliesRes = await fetch(`/api/v1/reports/anomalies?year=${selectedYear}&month=${selectedMonth}&threshold=2.0`)
          const anomaliesData = await anomaliesRes.json()
          setAnomalies(anomaliesData)
        } else {
          const summaryRes = await fetch(`/api/v1/reports/annual-summary?year=${selectedYear}`)
          const summaryData = await summaryRes.json()
          setSummary(summaryData)

          // Clear month-specific data for year view
          setMonthOverMonth(null)
          setSpendingVelocity(null)
          setAnomalies(null)
        }

        // Fetch trends using dashboard's date range
        const trendsRes = await fetch(
          `/api/v1/reports/trends?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`
        )
        const trendsData = await trendsRes.json()
        setTrends(trendsData)

        // Fetch top merchants for the date range
        const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''
        const merchantsRes = await fetch(`/api/v1/reports/top-merchants?limit=10&year=${selectedYear}${monthParam}`)
        const merchantsData = await merchantsRes.json()
        setTopMerchants(merchantsData)

        // Fetch Sankey flow data
        const sankeyRes = await fetch(`/api/v1/reports/sankey-flow?year=${selectedYear}${monthParam}`)
        const sankeyJson = await sankeyRes.json()
        setSankeyData(sankeyJson)

        // Fetch Treemap data
        const treemapRes = await fetch(`/api/v1/reports/treemap?year=${selectedYear}${monthParam}`)
        const treemapJson = await treemapRes.json()
        setTreemapData(treemapJson)

        // Fetch Heatmap data
        const heatmapRes = await fetch(`/api/v1/reports/spending-heatmap?year=${selectedYear}${monthParam}`)
        const heatmapJson = await heatmapRes.json()
        setHeatmapData(heatmapJson)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [currentDashboard?.id, startDate, endDate, selectedYear, selectedMonth])

  // Fetch data for widgets with filters (buckets, accounts, or merchants)
  useEffect(() => {
    async function fetchFilteredWidgetData() {
      if (!currentDashboard || !startDate || !endDate) return

      const filteredWidgets = widgets.filter(w => {
        if (!w.config) return false
        try {
          const config = JSON.parse(w.config)
          return (config.buckets && config.buckets.length > 0) ||
                 (config.accounts && config.accounts.length > 0) ||
                 (config.merchants && config.merchants.length > 0)
        } catch {
          return false
        }
      })

      if (filteredWidgets.length === 0) {
        setWidgetData({})
        return
      }

      const rangeType = currentDashboard.date_range_type
      const isMonthlyScale = rangeType === 'mtd' || rangeType === 'last_30_days'
      const groupBy = isMonthlyScale ? 'week' : 'month'
      const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''

      const newWidgetData: Record<number, any> = {}

      for (const widget of filteredWidgets) {
        const config = JSON.parse(widget.config!)

        // Build filter params
        const filterParams: string[] = []
        if (config.buckets?.length > 0) {
          filterParams.push(`buckets=${encodeURIComponent(config.buckets.join(','))}`)
        }
        if (config.accounts?.length > 0) {
          filterParams.push(`accounts=${encodeURIComponent(config.accounts.join(','))}`)
        }
        if (config.merchants?.length > 0) {
          filterParams.push(`merchants=${encodeURIComponent(config.merchants.join(','))}`)
        }
        const filterQuery = filterParams.length > 0 ? `&${filterParams.join('&')}` : ''

        try {
          let data = null
          switch (widget.widget_type) {
            case 'bucket_pie':
            case 'top_merchants': {
              // top_merchants doesn't support merchants filter (it groups by merchant)
              const tmFilterParams: string[] = []
              if (config.buckets?.length > 0) {
                tmFilterParams.push(`buckets=${encodeURIComponent(config.buckets.join(','))}`)
              }
              if (config.accounts?.length > 0) {
                tmFilterParams.push(`accounts=${encodeURIComponent(config.accounts.join(','))}`)
              }
              const tmFilterQuery = tmFilterParams.length > 0 ? `&${tmFilterParams.join('&')}` : ''
              const res = await fetch(`/api/v1/reports/top-merchants?limit=10&year=${selectedYear}${monthParam}${tmFilterQuery}`)
              data = await res.json()
              break
            }
            case 'trends': {
              const res = await fetch(
                `/api/v1/reports/trends?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}${filterQuery}`
              )
              data = await res.json()
              break
            }
            case 'sankey': {
              const res = await fetch(`/api/v1/reports/sankey-flow?year=${selectedYear}${monthParam}${filterQuery}`)
              data = await res.json()
              break
            }
            case 'treemap': {
              const res = await fetch(`/api/v1/reports/treemap?year=${selectedYear}${monthParam}${filterQuery}`)
              data = await res.json()
              break
            }
            case 'heatmap': {
              const res = await fetch(`/api/v1/reports/spending-heatmap?year=${selectedYear}${monthParam}${filterQuery}`)
              data = await res.json()
              break
            }
          }
          if (data) {
            newWidgetData[widget.id] = data
          }
        } catch (error) {
          console.error(`Error fetching data for widget ${widget.id}:`, error)
        }
      }

      setWidgetData(newWidgetData)
    }

    if (widgets.length > 0 && !loading) {
      fetchFilteredWidgetData()
    }
  }, [widgets, currentDashboard?.id, startDate, endDate, selectedYear, selectedMonth, loading])

  // Check if a widget type is visible
  const isWidgetVisible = useCallback((widgetType: string) => {
    const widget = widgets.find(w => w.widget_type === widgetType)
    return widget ? widget.is_visible : true
  }, [widgets])

  // Get visible widgets sorted by position
  const visibleWidgets = widgets
    .filter(w => w.is_visible)
    .sort((a, b) => a.position - b.position)

  if (dashboardLoading || loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!currentDashboard) {
    return <div className="text-center py-12">No dashboard available</div>
  }

  if (!summary) {
    return <div className="text-center py-12">No data available</div>
  }

  // Determine if this is a monthly-scale view for rendering
  const rangeType = currentDashboard.date_range_type
  const isMonthlyScale = rangeType === 'mtd' || rangeType === 'last_30_days'

  // Prepare bucket data for pie chart
  const bucketData = Object.entries(summary.bucket_breakdown || {}).map(([name, data]: [string, any]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: data.amount,
    count: data.count
  }))

  // Widget renderer functions
  const renderSummaryWidget = () => (
    <div key="summary" className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="card p-6">
        <p className="text-sm font-medium text-theme-muted">Total Income</p>
        <p className="mt-2 text-3xl font-bold text-positive">
          {formatCurrency(summary.total_income)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.income.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.income.amount >= 0 ? '+' : ''}{monthOverMonth.changes.income.percent.toFixed(1)}% vs last month
          </p>
        )}
      </div>
      <div className="card p-6">
        <p className="text-sm font-medium text-theme-muted">Total Expenses</p>
        <p className="mt-2 text-3xl font-bold text-negative">
          {formatCurrency(summary.total_expenses)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.expenses.amount < 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.expenses.amount >= 0 ? '+' : ''}{monthOverMonth.changes.expenses.percent.toFixed(1)}% vs last month
          </p>
        )}
      </div>
      <div className="card p-6">
        <p className="text-sm font-medium text-theme-muted">Net</p>
        <p className={`mt-2 text-3xl font-bold ${summary.net >= 0 ? 'text-positive' : 'text-negative'}`}>
          {formatCurrency(summary.net)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.net.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.net.amount >= 0 ? '+' : ''}{monthOverMonth.changes.net.percent.toFixed(1)}% vs last month
          </p>
        )}
      </div>
    </div>
  )

  const renderVelocityWidget = () => {
    const now = new Date()
    // Yearly-scale view: show annual velocity from summary
    if (!isMonthlyScale && summary) {
      const daysInYear = selectedYear === now.getFullYear()
        ? Math.floor((now.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : (selectedYear % 4 === 0 ? 366 : 365)
      const daysTotal = selectedYear % 4 === 0 ? 366 : 365

      return (
        <div key="velocity" className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">Annual Spending Rate</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-theme-muted">Daily Average</p>
              <p className="text-2xl font-bold text-theme">{formatCurrency(summary.daily_average || 0)}/day</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-theme-muted">Days Elapsed</p>
                <p className="text-lg font-semibold text-theme">{summary.days_elapsed || daysInYear} / {daysTotal}</p>
              </div>
              <div>
                <p className="text-sm text-theme-muted">Total Spending</p>
                <p className="text-lg font-semibold text-theme">{formatCurrency(summary.total_expenses)}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-theme-muted">Transactions</p>
              <p className="text-xl font-bold text-theme">{summary.transaction_count}</p>
            </div>
          </div>
        </div>
      )
    }

    // Month view: show monthly velocity
    if (!spendingVelocity) return null
    return (
      <div key="velocity" className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Daily Burn Rate</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-theme-muted">Daily Spending Rate</p>
            <p className="text-2xl font-bold text-theme">{spendingVelocity.insights.daily_burn_rate}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-muted">Days Elapsed</p>
              <p className="text-lg font-semibold text-theme">{spendingVelocity.days_elapsed} / {spendingVelocity.days_in_month}</p>
            </div>
            <div>
              <p className="text-sm text-theme-muted">Days Remaining</p>
              <p className="text-lg font-semibold text-theme">{spendingVelocity.insights.days_remaining}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-theme-muted">Projected Month Total</p>
            <p className="text-xl font-bold text-theme">{formatCurrency(spendingVelocity.projected_monthly.expenses)}</p>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 progress-bar">
                  <div
                    className={`h-2 rounded-full ${
                      spendingVelocity.pace === 'over_budget' ? 'progress-fill-negative' :
                      spendingVelocity.pace === 'under_budget' ? 'progress-fill-positive' :
                      'bg-blue-600'
                    }`}
                    style={{ width: `${(spendingVelocity.days_elapsed / spendingVelocity.days_in_month) * 100}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${
                  spendingVelocity.pace === 'over_budget' ? 'text-negative' :
                  spendingVelocity.pace === 'under_budget' ? 'text-positive' :
                  'text-blue-500'
                }`}>
                  {spendingVelocity.pace === 'over_budget' ? 'Over Budget' :
                   spendingVelocity.pace === 'under_budget' ? 'Under Budget' :
                   'On Track'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs text-theme-muted">
            <p>Projected remaining: {formatCurrency(spendingVelocity.insights.projected_remaining_spending)}</p>
            <p>Previous month: {formatCurrency(spendingVelocity.previous_month.expenses)}</p>
          </div>
        </div>
      </div>
    )
  }

  const renderAnomaliesWidget = () => {
    if (!anomalies) return null
    return (
      <div key="anomalies" className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Unusual Activity</h2>
        {anomalies.summary.total_anomalies === 0 ? (
          <p className="text-theme-muted text-center py-8">No unusual activity detected</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Link
                href={`/transactions?amount_max=-${anomalies.summary.large_threshold_amount || 100}&start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                className="bg-negative rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
                title={anomalies.summary.large_threshold_amount ? `Transactions over $${Math.round(anomalies.summary.large_threshold_amount)} (2σ above average)` : 'Large transactions'}
              >
                <p className="text-2xl font-bold text-negative">{anomalies.summary.large_transaction_count}</p>
                <p className="text-xs text-theme-muted">Large</p>
              </Link>
              <Link
                href={`/transactions?start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                className="bg-blue-500/20 rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
                title="View transactions from new merchants"
              >
                <p className="text-2xl font-bold text-blue-500">{anomalies.summary.new_merchant_count}</p>
                <p className="text-xs text-theme-muted">New</p>
              </Link>
              <Link
                href={`/transactions?start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                className="bg-orange-500/20 rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
                title="View buckets with unusually high spending"
              >
                <p className="text-2xl font-bold text-orange-500">{anomalies.summary.unusual_bucket_count}</p>
                <p className="text-xs text-theme-muted">Over Avg</p>
              </Link>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {anomalies.anomalies.large_transactions.slice(0, 3).map((txn: any, idx: number) => (
                <Link
                  key={`large-${idx}`}
                  href={`/transactions?search=${encodeURIComponent(txn.merchant || '')}&start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                  className="block border-l-4 border-red-500 pl-3 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <p className="text-sm font-medium text-theme">{formatCurrency(txn.amount)} - {txn.merchant}</p>
                  <p className="text-xs text-theme-muted">{txn.reason}</p>
                </Link>
              ))}
              {anomalies.anomalies.new_merchants.slice(0, 3).map((txn: any, idx: number) => (
                <Link
                  key={`new-${idx}`}
                  href={`/transactions?search=${encodeURIComponent(txn.merchant || '')}&start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                  className="block border-l-4 border-blue-500 pl-3 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <p className="text-sm font-medium text-theme">{formatCurrency(txn.amount)} - {txn.merchant}</p>
                  <p className="text-xs text-theme-muted">{txn.reason}</p>
                </Link>
              ))}
              {anomalies.anomalies.unusual_buckets.slice(0, 2).map((bucket: any, idx: number) => (
                <Link
                  key={`bucket-${idx}`}
                  href={`/transactions?bucket=${encodeURIComponent(bucket.bucket || '')}&start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                  className="block border-l-4 border-orange-500 pl-3 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <p className="text-sm font-medium text-theme">{bucket.bucket}</p>
                  <p className="text-xs text-theme-muted">{bucket.reason}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderBucketPieWidget = (widget?: Widget, customData?: any) => (
    <div key={widget?.id ?? "bucket_pie"} className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{widget?.title || 'Spending by Bucket'}</h2>
      {bucketData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={bucketData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {bucketData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-theme-muted text-center py-12">No bucket data available</p>
      )}
    </div>
  )

  const renderTopMerchantsWidget = (widget?: Widget, customData?: any) => {
    const data = customData || topMerchants
    return (
    <div key={widget?.id ?? "top_merchants"} className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{widget?.title || 'Top Merchants'}</h2>
      {data && data.merchants.length > 0 ? (
        <div className="space-y-3">
          {data.merchants.slice(0, 10).map((merchant: any, index: number) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-theme">{merchant.merchant}</span>
              <span className="text-sm font-semibold text-theme">
                {formatCurrency(merchant.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-theme-muted text-center py-12">No merchant data available</p>
      )}
    </div>
  )}

  const renderTrendsWidget = (widget?: Widget, customData?: any) => {
    const data = customData || trends
    if (!data || !data.data || data.data.length === 0) return null

    const isWeekly = data.group_by === 'week'
    const title = widget?.title || (isMonthlyScale ? '12-Week Trend' : '12-Month Trend')

    // Format period labels for display
    const formatPeriodLabel = (period: string) => {
      if (isWeekly) {
        // Format "2024-W48" to "W48"
        return period.split('-')[1] || period
      } else {
        // Format "2024-01" to "Jan"
        const [year, month] = period.split('-')
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        return monthNames[parseInt(month) - 1] || period
      }
    }

    return (
      <div key={widget?.id ?? "trends"} className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tickFormatter={formatPeriodLabel} />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: any) => formatCurrency(value)}
              labelFormatter={(label) => isWeekly ? `Week ${label.split('-')[1]?.replace('W', '') || label}` : formatPeriodLabel(label)}
            />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#10b981" name="Income" />
            <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" />
            <Line type="monotone" dataKey="net" stroke="#3b82f6" name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderSankeyWidget = (widget?: Widget, customData?: any) => {
    const data = customData || sankeyData
    const title = widget?.title || 'Money Flow'

    if (!data || !data.nodes || data.nodes.length === 0) {
      return (
        <div key={widget?.id ?? "sankey"} className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
          <p className="text-theme-muted text-center py-12">No flow data available for this period</p>
        </div>
      )
    }

    // Custom node component with labels - uses CSS variables directly for theme reactivity
    const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
      const name = payload?.name || data.nodes[index]?.name || ''
      const isLeftSide = x < 200
      const colorVar = CHART_VARS[index % CHART_VARS.length]
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            style={{ fill: colorVar, stroke: colorVar }}
          />
          <text
            x={isLeftSide ? x - 6 : x + width + 6}
            y={y + height / 2}
            textAnchor={isLeftSide ? 'end' : 'start'}
            dominantBaseline="middle"
            fontSize={12}
            style={{ fill: 'var(--chart-text)' }}
          >
            {name}
          </text>
        </g>
      )
    }

    return (
      <div key={widget?.id ?? "sankey"} className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        <p className="text-sm text-theme-muted mb-4">Income → Accounts → Spending Categories</p>
        <ResponsiveContainer width="100%" height={450}>
          <Sankey
            data={data}
            nodePadding={40}
            nodeWidth={12}
            linkCurvature={0.5}
            margin={{ top: 20, right: 150, bottom: 20, left: 150 }}
            node={<SankeyNode />}
            link={{
              stroke: 'var(--chart-link)'
            }}
          >
            <Tooltip
              formatter={(value: any) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg)',
                border: 'none',
                borderRadius: '6px',
                color: 'var(--tooltip-text)'
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderTreemapWidget = (widget?: Widget, customData?: any) => {
    const data = customData || treemapData
    const title = widget?.title || 'Spending Breakdown'

    if (!data || !data.data || data.data.children.length === 0) {
      return (
        <div key={widget?.id ?? "treemap"} className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
          <p className="text-theme-muted text-center py-12">No spending data available for this period</p>
        </div>
      )
    }

    // Truncate text to fit within available width
    const truncateText = (text: string, maxWidth: number, fontSize: number) => {
      const avgCharWidth = fontSize * 0.6
      const maxChars = Math.floor((maxWidth - 16) / avgCharWidth) // 16px padding
      if (text.length <= maxChars) return text
      return maxChars > 3 ? text.slice(0, maxChars - 1) + '…' : ''
    }

    return (
      <div key={widget?.id ?? "treemap"} className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        <p className="text-sm text-theme-muted mb-4">Spending by category and merchant</p>
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={data.data.children}
            dataKey="value"
            aspectRatio={4/3}
            stroke="#fff"
            fill="#8884d8"
            content={({ x, y, width, height, name, value, index }: any) => {
              const showLabels = width >= 60 && height >= 40
              const fontSize = Math.min(14, Math.max(10, width / 8))
              const truncatedName = truncateText(name || '', width, fontSize)
              const colorVar = CHART_VARS[index % CHART_VARS.length]

              return (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                      fill: colorVar,
                      stroke: 'rgba(255,255,255,0.3)',
                      strokeWidth: 1
                    }}
                    rx={3}
                    ry={3}
                  />
                  {showLabels && truncatedName && (
                    <>
                      <text
                        x={x + 8}
                        y={y + 20}
                        textAnchor="start"
                        fontSize={fontSize}
                        fontWeight="600"
                        style={{ fill: 'var(--chart-text-light)', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {truncatedName}
                      </text>
                      {height >= 55 && (
                        <text
                          x={x + 8}
                          y={y + 38}
                          textAnchor="start"
                          fontSize={fontSize - 2}
                          style={{ fill: 'var(--chart-text-light)', opacity: 0.8 }}
                        >
                          {formatCurrency(value)}
                        </text>
                      )}
                    </>
                  )}
                </g>
              )
            }}
          >
            <Tooltip
              formatter={(value: any) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg)',
                border: 'none',
                borderRadius: '6px',
                color: 'var(--tooltip-text)'
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderHeatmapWidget = (widget?: Widget, customData?: any) => {
    const data = customData || heatmapData
    const title = widget?.title || (isMonthlyScale ? 'Spending Calendar' : 'Monthly Spending Overview')

    if (!data || !data.days) {
      return (
        <div key={widget?.id ?? "heatmap"} className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
          <p className="text-theme-muted text-center py-12">No spending data available</p>
        </div>
      )
    }

    // Yearly-scale view: show monthly grid
    if (!isMonthlyScale) {
      return (
        <div key={widget?.id ?? "heatmap"} className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
          {data.summary && (
            <div className="flex gap-6 mb-4 text-sm">
              <div>
                <span className="text-theme-muted">Total: </span>
                <span className="font-semibold text-theme">{formatCurrency(data.summary.total_spending)}</span>
              </div>
              <div>
                <span className="text-theme-muted">Max Month: </span>
                <span className="font-semibold text-theme">{formatCurrency(data.summary.max_monthly || 0)}</span>
              </div>
              <div>
                <span className="text-theme-muted">Active Months: </span>
                <span className="font-semibold text-theme">{data.summary.months_with_spending || 0}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {data.days.map((month: any) => {
              const colorVar = HEATMAP_VARS[Math.min(month.intensity, 5)]
              const useLightText = month.intensity >= 3

              return (
                <div
                  key={month.month}
                  className="rounded-lg p-3 flex flex-col items-center justify-center"
                  style={{ backgroundColor: colorVar }}
                  title={`${month.month_name}: ${formatCurrency(month.amount)} (${month.count} transactions)`}
                >
                  <span
                    className="font-semibold text-sm"
                    style={{ color: useLightText ? 'var(--chart-text-light)' : 'var(--chart-text)' }}
                  >
                    {month.month_name}
                  </span>
                  <span
                    className="text-xs mt-1"
                    style={{ color: useLightText ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}
                  >
                    {formatCurrency(month.amount)}
                  </span>
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 text-xs text-theme-muted">
            <span>Less</span>
            {HEATMAP_VARS.map((colorVar, i) => (
              <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: colorVar }} />
            ))}
            <span>More</span>
          </div>
        </div>
      )
    }

    // Month view: show daily calendar
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    // Organize days into weeks (7 columns)
    const firstDayWeekday = data.days[0]?.weekday ?? 0
    const paddedDays = [
      ...Array(firstDayWeekday).fill(null),
      ...data.days
    ]
    const weeks: any[][] = []
    for (let i = 0; i < paddedDays.length; i += 7) {
      weeks.push(paddedDays.slice(i, i + 7))
    }

    return (
      <div key={widget?.id ?? "heatmap"} className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        {data.summary && (
          <div className="flex gap-6 mb-4 text-sm">
            <div>
              <span className="text-theme-muted">Total: </span>
              <span className="font-semibold text-theme">{formatCurrency(data.summary.total_spending)}</span>
            </div>
            <div>
              <span className="text-theme-muted">Max Day: </span>
              <span className="font-semibold text-theme">{formatCurrency(data.summary.max_daily)}</span>
            </div>
            <div>
              <span className="text-theme-muted">Active Days: </span>
              <span className="font-semibold text-theme">{data.summary.days_with_spending}</span>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <div className="inline-block">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekdays.map(day => (
                <div key={day} className="text-xs text-theme-muted text-center w-10">
                  {day}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
                {week.map((day: any, dayIndex: number) => {
                  const colorVar = day ? HEATMAP_VARS[Math.min(day.intensity, 5)] : 'transparent'
                  // For higher intensities (3+), use light text; for lower, use theme text
                  const useLightText = day && day.intensity >= 3

                  return (
                    <div
                      key={dayIndex}
                      className="w-10 h-10 rounded flex flex-col items-center justify-center text-xs"
                      style={{ backgroundColor: colorVar }}
                      title={day ? `${format(new Date(selectedYear, selectedMonth - 1, day.day), 'MMM d')}: ${formatCurrency(day.amount)} (${day.count} transactions)` : ''}
                    >
                      {day && (
                        <>
                          <span
                            className="font-medium"
                            style={{ color: useLightText ? 'var(--chart-text-light)' : 'var(--chart-text)' }}
                          >
                            {day.day}
                          </span>
                          {day.amount > 0 && (
                            <span
                              className="text-[8px]"
                              style={{ color: useLightText ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}
                            >
                              ${Math.round(day.amount)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-theme-muted">
          <span>Less</span>
          {HEATMAP_VARS.map((colorVar, i) => (
            <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: colorVar }} />
          ))}
          <span>More</span>
        </div>
      </div>
    )
  }

  // Render widget by type
  const renderWidget = (widget: Widget) => {
    // Check if this widget has custom data from bucket filter
    const customData = widgetData[widget.id]

    switch (widget.widget_type) {
      case 'summary':
        return renderSummaryWidget()
      case 'velocity':
        return renderVelocityWidget()
      case 'anomalies':
        return renderAnomaliesWidget()
      case 'bucket_pie':
        return renderBucketPieWidget(widget, customData)
      case 'top_merchants':
        return renderTopMerchantsWidget(widget, customData)
      case 'trends':
        return renderTrendsWidget(widget, customData)
      case 'sankey':
        return renderSankeyWidget(widget, customData)
      case 'treemap':
        return renderTreemapWidget(widget, customData)
      case 'heatmap':
        return renderHeatmapWidget(widget, customData)
      default:
        return null
    }
  }

  // Group widgets by layout section
  const summaryWidget = visibleWidgets.find(w => w.widget_type === 'summary')
  const halfWidgets = visibleWidgets.filter(w => w.width === 'half' && w.widget_type !== 'summary')
  const fullWidgets = visibleWidgets.filter(w => w.width === 'full' && w.widget_type !== 'summary')

  return (
    <div className="space-y-8">
      <PageHelp
        pageId="dashboard"
        title="Dashboard Help"
        description="Your financial overview at a glance. See income, expenses, and spending trends for the current month."
        steps={[
          "View summary cards for income, expenses, and net for this month",
          "Track your daily burn rate and projected spending",
          "Review unusual activity and anomalies",
          "See spending breakdown by bucket and top merchants"
        ]}
        tips={[
          "Month-over-month comparisons show how you're doing vs last month",
          "The spending velocity shows if you're on track for the month",
          "Click through to Transactions for detailed views",
          "Use the Customize button to show/hide and reorder widgets"
        ]}
      />

      {/* Dashboard Tabs */}
      <DashboardTabs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme">Dashboard</h1>
          <p className="text-sm text-theme-muted mt-1">
            {startDate} to {endDate}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={currentDashboard.date_range_type}
            onChange={(e) => handleDateRangeChange(e.target.value as DateRangeType)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <DashboardConfig
            widgets={widgets}
            onToggleVisibility={handleToggleVisibility}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />
        </div>
      </div>

      {/* Render widgets based on configuration */}
      {visibleWidgets.length === 0 ? (
        <div className="card p-12 text-center text-theme-muted">
          <p>No widgets visible. Click "Customize" to configure your dashboard.</p>
        </div>
      ) : (
        <>
          {/* Summary widget (always full width, usually first) */}
          {summaryWidget && renderWidget(summaryWidget)}

          {/* Half-width widgets in 2-column grid */}
          {halfWidgets.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {halfWidgets.map(widget => renderWidget(widget))}
            </div>
          )}

          {/* Full-width widgets */}
          {fullWidgets.map(widget => renderWidget(widget))}
        </>
      )}
    </div>
  )
}
