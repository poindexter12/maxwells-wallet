'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Sankey, Treemap } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'
import { DashboardConfig } from '@/components/DashboardConfig'

// Muted, professional color palette for charts
const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308']
// Treemap uses a separate, more subtle palette with good contrast
const TREEMAP_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308'
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
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [monthlySummary, setMonthlySummary] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [topMerchants, setTopMerchants] = useState<any>(null)
  const [monthOverMonth, setMonthOverMonth] = useState<any>(null)
  const [spendingVelocity, setSpendingVelocity] = useState<any>(null)
  const [anomalies, setAnomalies] = useState<any>(null)
  const [sankeyData, setSankeyData] = useState<any>(null)
  const [treemapData, setTreemapData] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  // Fetch widget configuration
  useEffect(() => {
    fetchWidgets()
  }, [])

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

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // Fetch selected month summary
        const summaryRes = await fetch(`/api/v1/reports/monthly-summary?year=${selectedYear}&month=${selectedMonth}`)
        const summaryData = await summaryRes.json()
        setMonthlySummary(summaryData)

        // Fetch 6-month trends ending at selected month
        const selectedDate = new Date(selectedYear, selectedMonth - 1, 1)
        const sixMonthsAgo = new Date(selectedYear, selectedMonth - 7, 1)
        const trendsRes = await fetch(
          `/api/v1/reports/trends?start_date=${format(sixMonthsAgo, 'yyyy-MM-dd')}&end_date=${format(selectedDate, 'yyyy-MM-dd')}&group_by=month`
        )
        const trendsData = await trendsRes.json()
        setTrends(trendsData)

        // Fetch top merchants for selected month
        const merchantsRes = await fetch(`/api/v1/reports/top-merchants?limit=10&year=${selectedYear}&month=${selectedMonth}`)
        const merchantsData = await merchantsRes.json()
        setTopMerchants(merchantsData)

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

        // Fetch Sankey flow data
        const sankeyRes = await fetch(`/api/v1/reports/sankey-flow?year=${selectedYear}&month=${selectedMonth}`)
        const sankeyJson = await sankeyRes.json()
        setSankeyData(sankeyJson)

        // Fetch Treemap data
        const treemapRes = await fetch(`/api/v1/reports/treemap?year=${selectedYear}&month=${selectedMonth}`)
        const treemapJson = await treemapRes.json()
        setTreemapData(treemapJson)

        // Fetch Heatmap data
        const heatmapRes = await fetch(`/api/v1/reports/spending-heatmap?year=${selectedYear}&month=${selectedMonth}`)
        const heatmapJson = await heatmapRes.json()
        setHeatmapData(heatmapJson)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedYear, selectedMonth])

  // Check if a widget type is visible
  const isWidgetVisible = useCallback((widgetType: string) => {
    const widget = widgets.find(w => w.widget_type === widgetType)
    return widget ? widget.is_visible : true
  }, [widgets])

  // Get visible widgets sorted by position
  const visibleWidgets = widgets
    .filter(w => w.is_visible)
    .sort((a, b) => a.position - b.position)

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!monthlySummary) {
    return <div className="text-center py-12">No data available</div>
  }

  // Prepare bucket data for pie chart
  const bucketData = Object.entries(monthlySummary.bucket_breakdown || {}).map(([name, data]: [string, any]) => ({
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
          {formatCurrency(monthlySummary.total_income)}
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
          {formatCurrency(monthlySummary.total_expenses)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.expenses.amount < 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.expenses.amount >= 0 ? '+' : ''}{monthOverMonth.changes.expenses.percent.toFixed(1)}% vs last month
          </p>
        )}
      </div>
      <div className="card p-6">
        <p className="text-sm font-medium text-theme-muted">Net</p>
        <p className={`mt-2 text-3xl font-bold ${monthlySummary.net >= 0 ? 'text-positive' : 'text-negative'}`}>
          {formatCurrency(monthlySummary.net)}
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

  const renderBucketPieWidget = () => (
    <div key="bucket_pie" className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">Spending by Bucket</h2>
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

  const renderTopMerchantsWidget = () => (
    <div key="top_merchants" className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">Top Merchants</h2>
      {topMerchants && topMerchants.merchants.length > 0 ? (
        <div className="space-y-3">
          {topMerchants.merchants.slice(0, 10).map((merchant: any, index: number) => (
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
  )

  const renderTrendsWidget = () => {
    if (!trends || !trends.data || trends.data.length === 0) return null
    return (
      <div key="trends" className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">6-Month Trend</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#10b981" name="Income" />
            <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" />
            <Line type="monotone" dataKey="net" stroke="#3b82f6" name="Net" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderSankeyWidget = () => {
    if (!sankeyData || !sankeyData.nodes || sankeyData.nodes.length === 0) {
      return (
        <div key="sankey" className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">Money Flow</h2>
          <p className="text-theme-muted text-center py-12">No flow data available for this month</p>
        </div>
      )
    }

    // Custom node component with labels
    const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
      const name = payload?.name || sankeyData.nodes[index]?.name || ''
      const isLeftSide = x < 200
      return (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={COLORS[index % COLORS.length]}
            stroke={COLORS[index % COLORS.length]}
          />
          <text
            x={isLeftSide ? x - 6 : x + width + 6}
            y={y + height / 2}
            textAnchor={isLeftSide ? 'end' : 'start'}
            dominantBaseline="middle"
            fontSize={12}
            fill="currentColor"
            className="text-theme"
          >
            {name}
          </text>
        </g>
      )
    }

    return (
      <div key="sankey" className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Money Flow</h2>
        <p className="text-sm text-theme-muted mb-4">Income → Accounts → Spending Categories</p>
        <ResponsiveContainer width="100%" height={450}>
          <Sankey
            data={sankeyData}
            nodePadding={40}
            nodeWidth={12}
            linkCurvature={0.5}
            margin={{ top: 20, right: 150, bottom: 20, left: 150 }}
            node={<SankeyNode />}
            link={{
              stroke: '#94a3b8',
              strokeOpacity: 0.4
            }}
          >
            <Tooltip
              formatter={(value: any) => formatCurrency(value)}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderTreemapWidget = () => {
    if (!treemapData || !treemapData.data || treemapData.data.children.length === 0) {
      return (
        <div key="treemap" className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">Spending Breakdown</h2>
          <p className="text-theme-muted text-center py-12">No spending data available for this month</p>
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
      <div key="treemap" className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Spending Breakdown</h2>
        <p className="text-sm text-theme-muted mb-4">Spending by category and merchant</p>
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={treemapData.data.children}
            dataKey="value"
            aspectRatio={4/3}
            stroke="#fff"
            fill="#8884d8"
            content={({ x, y, width, height, name, value, index, depth }: any) => {
              const showLabels = width >= 60 && height >= 40
              const fontSize = Math.min(14, Math.max(10, width / 8))
              const truncatedName = truncateText(name || '', width, fontSize)
              const color = TREEMAP_COLORS[index % TREEMAP_COLORS.length]

              return (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                      fill: color,
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
                        fill="rgba(255,255,255,0.95)"
                        fontSize={fontSize}
                        fontWeight="600"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                      >
                        {truncatedName}
                      </text>
                      {height >= 55 && (
                        <text
                          x={x + 8}
                          y={y + 38}
                          textAnchor="start"
                          fill="rgba(255,255,255,0.8)"
                          fontSize={fontSize - 2}
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
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff'
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderHeatmapWidget = () => {
    if (!heatmapData || !heatmapData.days) {
      return (
        <div key="heatmap" className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">Spending Calendar</h2>
          <p className="text-theme-muted text-center py-12">No spending data available</p>
        </div>
      )
    }

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const intensityColors = [
      'bg-gray-100 dark:bg-gray-800',
      'bg-green-200 dark:bg-green-900',
      'bg-green-400 dark:bg-green-700',
      'bg-green-500 dark:bg-green-600',
      'bg-green-600 dark:bg-green-500',
      'bg-green-700 dark:bg-green-400'
    ]

    // Organize days into weeks (7 columns)
    const firstDayWeekday = heatmapData.days[0]?.weekday ?? 0
    const paddedDays = [
      ...Array(firstDayWeekday).fill(null),
      ...heatmapData.days
    ]
    const weeks: any[][] = []
    for (let i = 0; i < paddedDays.length; i += 7) {
      weeks.push(paddedDays.slice(i, i + 7))
    }

    return (
      <div key="heatmap" className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Spending Calendar</h2>
        {heatmapData.summary && (
          <div className="flex gap-6 mb-4 text-sm">
            <div>
              <span className="text-theme-muted">Total: </span>
              <span className="font-semibold text-theme">{formatCurrency(heatmapData.summary.total_spending)}</span>
            </div>
            <div>
              <span className="text-theme-muted">Max Day: </span>
              <span className="font-semibold text-theme">{formatCurrency(heatmapData.summary.max_daily)}</span>
            </div>
            <div>
              <span className="text-theme-muted">Active Days: </span>
              <span className="font-semibold text-theme">{heatmapData.summary.days_with_spending}</span>
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
                {week.map((day: any, dayIndex: number) => (
                  <div
                    key={dayIndex}
                    className={`w-10 h-10 rounded flex flex-col items-center justify-center text-xs ${
                      day ? intensityColors[Math.min(day.intensity, 5)] : 'bg-transparent'
                    }`}
                    title={day ? `${format(new Date(selectedYear, selectedMonth - 1, day.day), 'MMM d')}: ${formatCurrency(day.amount)} (${day.count} transactions)` : ''}
                  >
                    {day && (
                      <>
                        <span className={`font-medium ${day.intensity > 2 ? 'text-white' : 'text-theme'}`}>
                          {day.day}
                        </span>
                        {day.amount > 0 && (
                          <span className={`text-[8px] ${day.intensity > 2 ? 'text-white/80' : 'text-theme-muted'}`}>
                            ${Math.round(day.amount)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-theme-muted">
          <span>Less</span>
          {intensityColors.map((color, i) => (
            <div key={i} className={`w-4 h-4 rounded ${color}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    )
  }

  // Render widget by type
  const renderWidget = (widget: Widget) => {
    switch (widget.widget_type) {
      case 'summary':
        return renderSummaryWidget()
      case 'velocity':
        return renderVelocityWidget()
      case 'anomalies':
        return renderAnomaliesWidget()
      case 'bucket_pie':
        return renderBucketPieWidget()
      case 'top_merchants':
        return renderTopMerchantsWidget()
      case 'trends':
        return renderTrendsWidget()
      case 'sankey':
        return renderSankeyWidget()
      case 'treemap':
        return renderTreemapWidget()
      case 'heatmap':
        return renderHeatmapWidget()
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme">Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <DashboardConfig
            widgets={widgets}
            onToggleVisibility={handleToggleVisibility}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onReset={handleReset}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedMonth === 1) {
                  setSelectedYear(selectedYear - 1)
                  setSelectedMonth(12)
                } else {
                  setSelectedMonth(selectedMonth - 1)
                }
              }}
              className="p-2 rounded-md hover:bg-[var(--color-bg-hover)] text-theme-muted hover:text-theme"
              title="Previous month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-lg font-medium text-theme min-w-[140px] text-center">
              {format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy')}
            </span>
            <button
              onClick={() => {
                if (selectedMonth === 12) {
                  setSelectedYear(selectedYear + 1)
                  setSelectedMonth(1)
                } else {
                  setSelectedMonth(selectedMonth + 1)
                }
              }}
              disabled={selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1}
              className="p-2 rounded-md hover:bg-[var(--color-bg-hover)] text-theme-muted hover:text-theme disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next month"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
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
