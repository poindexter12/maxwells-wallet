'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHelp } from '@/components/PageHelp'
import { DashboardConfig } from '@/components/DashboardConfig'
import DashboardTabs from '@/components/DashboardTabs'
import { useDashboard, DateRangeType } from '@/contexts/DashboardContext'
import { useWidgetManagement } from '@/hooks/useWidgetManagement'
import {
  WidgetRenderer,
  Widget,
  SummaryData,
  MonthOverMonthData,
  SpendingVelocityData,
  AnomaliesData,
  TrendsData,
  TopMerchantsData
} from '@/components/widgets'

const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
  { value: 'mtd', label: 'Month to Date' },
  { value: 'qtd', label: 'Quarter to Date' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_year', label: 'Last Year' },
]

export default function Dashboard() {
  const { currentDashboard, loading: dashboardLoading, updateDashboard } = useDashboard()
  const { widgets, fetchWidgets, toggleVisibility, moveUp, moveDown } = useWidgetManagement()

  // Dashboard data state
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [trends, setTrends] = useState<TrendsData | null>(null)
  const [topMerchants, setTopMerchants] = useState<TopMerchantsData | null>(null)
  const [monthOverMonth, setMonthOverMonth] = useState<MonthOverMonthData | null>(null)
  const [spendingVelocity, setSpendingVelocity] = useState<SpendingVelocityData | null>(null)
  const [anomalies, setAnomalies] = useState<AnomaliesData | null>(null)
  const [sankeyData, setSankeyData] = useState<any>(null)
  const [treemapData, setTreemapData] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [widgetData, setWidgetData] = useState<Record<number, any>>({})

  // Extract date info from current dashboard with fallback validation
  const startDate = currentDashboard?.date_range?.start_date || ''
  const endDate = currentDashboard?.date_range?.end_date || ''
  const now = new Date()
  const parsedYear = endDate ? parseInt(endDate.split('-')[0]) : NaN
  const parsedMonth = endDate ? parseInt(endDate.split('-')[1]) : NaN
  const selectedYear = !isNaN(parsedYear) ? parsedYear : now.getFullYear()
  const selectedMonth = !isNaN(parsedMonth) ? parsedMonth : now.getMonth() + 1

  // Fetch widgets when dashboard changes
  useEffect(() => {
    if (currentDashboard) {
      fetchWidgets()
    }
  }, [currentDashboard?.id, fetchWidgets])

  // Fetch dashboard data
  useEffect(() => {
    async function fetchData() {
      if (!currentDashboard || !startDate || !endDate) return

      setLoading(true)
      try {
        const rangeType = currentDashboard.date_range_type
        const isMonthlyScale = rangeType === 'mtd' || rangeType === 'last_30_days'
        const isYearlyScale = rangeType === 'ytd' || rangeType === 'last_year' || rangeType === 'last_90_days'
        const groupBy = isYearlyScale ? 'month' : 'week'

        // Fetch summary based on date range
        if (isMonthlyScale) {
          const [summaryRes, momRes, velocityRes, anomaliesRes] = await Promise.all([
            fetch(`/api/v1/reports/monthly-summary?year=${selectedYear}&month=${selectedMonth}`),
            fetch(`/api/v1/reports/month-over-month?current_year=${selectedYear}&current_month=${selectedMonth}`),
            fetch(`/api/v1/reports/spending-velocity?year=${selectedYear}&month=${selectedMonth}`),
            fetch(`/api/v1/reports/anomalies?year=${selectedYear}&month=${selectedMonth}&threshold=2.0`)
          ])

          setSummary(await summaryRes.json())
          setMonthOverMonth(await momRes.json())
          setSpendingVelocity(await velocityRes.json())
          setAnomalies(await anomaliesRes.json())
        } else {
          const summaryRes = await fetch(`/api/v1/reports/annual-summary?year=${selectedYear}`)
          setSummary(await summaryRes.json())
          setMonthOverMonth(null)
          setSpendingVelocity(null)
          setAnomalies(null)
        }

        const monthParam = isMonthlyScale ? `&month=${selectedMonth}` : ''

        // Fetch remaining data in parallel
        const [trendsRes, merchantsRes, sankeyRes, treemapRes, heatmapRes] = await Promise.all([
          fetch(`/api/v1/reports/trends?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`),
          fetch(`/api/v1/reports/top-merchants?limit=10&year=${selectedYear}${monthParam}`),
          fetch(`/api/v1/reports/sankey-flow?year=${selectedYear}${monthParam}`),
          fetch(`/api/v1/reports/treemap?year=${selectedYear}${monthParam}`),
          fetch(`/api/v1/reports/spending-heatmap?year=${selectedYear}${monthParam}`)
        ])

        setTrends(await trendsRes.json())
        setTopMerchants(await merchantsRes.json())
        setSankeyData(await sankeyRes.json())
        setTreemapData(await treemapRes.json())
        setHeatmapData(await heatmapRes.json())

        setLoading(false)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [currentDashboard?.id, startDate, endDate, selectedYear, selectedMonth])

  // Fetch filtered widget data
  useEffect(() => {
    async function fetchFilteredWidgetData() {
      if (!currentDashboard || !startDate || !endDate) return

      const filteredWidgets = widgets.filter(w => {
        if (!w.config) return false
        try {
          const config = JSON.parse(w.config)
          return (config.buckets?.length > 0) || (config.accounts?.length > 0) || (config.merchants?.length > 0)
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
        const filterParams: string[] = []
        if (config.buckets?.length > 0) filterParams.push(`buckets=${encodeURIComponent(config.buckets.join(','))}`)
        if (config.accounts?.length > 0) filterParams.push(`accounts=${encodeURIComponent(config.accounts.join(','))}`)
        if (config.merchants?.length > 0) filterParams.push(`merchants=${encodeURIComponent(config.merchants.join(','))}`)
        const filterQuery = filterParams.length > 0 ? `&${filterParams.join('&')}` : ''

        try {
          let data = null
          switch (widget.widget_type) {
            case 'bucket_pie':
            case 'top_merchants': {
              const tmFilterParams = filterParams.filter(p => !p.startsWith('merchants='))
              const tmFilterQuery = tmFilterParams.length > 0 ? `&${tmFilterParams.join('&')}` : ''
              const res = await fetch(`/api/v1/reports/top-merchants?limit=10&year=${selectedYear}${monthParam}${tmFilterQuery}`)
              data = await res.json()
              break
            }
            case 'trends': {
              const res = await fetch(`/api/v1/reports/trends?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}${filterQuery}`)
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
          if (data) newWidgetData[widget.id] = data
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

  const handleDateRangeChange = useCallback(async (dateRangeType: DateRangeType) => {
    if (!currentDashboard) return
    await updateDashboard(currentDashboard.id, { date_range_type: dateRangeType })
  }, [currentDashboard, updateDashboard])

  // Loading states
  if (dashboardLoading || loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!currentDashboard) {
    return <div className="text-center py-12">No dashboard available</div>
  }

  if (!summary) {
    return <div className="text-center py-12">No data available</div>
  }

  // Derived values
  const rangeType = currentDashboard.date_range_type
  const isMonthlyScale = rangeType === 'mtd' || rangeType === 'last_30_days'

  const bucketData = Object.entries(summary.bucket_breakdown || {}).map(([name, data]: [string, any]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: data.amount,
    count: data.count
  }))

  const visibleWidgets = widgets
    .filter(w => w.is_visible)
    .sort((a, b) => a.position - b.position)

  const summaryWidget = visibleWidgets.find(w => w.widget_type === 'summary')
  const halfWidgets = visibleWidgets.filter(w => w.width === 'half' && w.widget_type !== 'summary')
  const fullWidgets = visibleWidgets.filter(w => w.width === 'full' && w.widget_type !== 'summary')

  const renderWidget = (widget: Widget) => (
    <WidgetRenderer
      key={widget.id}
      widget={widget}
      summary={summary}
      monthOverMonth={monthOverMonth}
      spendingVelocity={spendingVelocity}
      anomalies={anomalies}
      trends={trends}
      topMerchants={topMerchants}
      sankeyData={sankeyData}
      treemapData={treemapData}
      heatmapData={heatmapData}
      isMonthlyScale={isMonthlyScale}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      bucketData={bucketData}
      customData={widgetData[widget.id]}
    />
  )

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
            onToggleVisibility={toggleVisibility}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        </div>
      </div>

      {visibleWidgets.length === 0 ? (
        <div className="card p-12 text-center text-theme-muted">
          <p>No widgets visible. Click "Customize" to configure your dashboard.</p>
        </div>
      ) : (
        <>
          {summaryWidget && renderWidget(summaryWidget)}

          {halfWidgets.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {halfWidgets.map(widget => renderWidget(widget))}
            </div>
          )}

          {fullWidgets.map(widget => renderWidget(widget))}
        </>
      )}
    </div>
  )
}
