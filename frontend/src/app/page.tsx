'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D']

export default function Dashboard() {
  const [monthlySummary, setMonthlySummary] = useState<any>(null)
  const [trends, setTrends] = useState<any>(null)
  const [topMerchants, setTopMerchants] = useState<any>(null)
  const [monthOverMonth, setMonthOverMonth] = useState<any>(null)
  const [spendingVelocity, setSpendingVelocity] = useState<any>(null)
  const [anomalies, setAnomalies] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

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

        setLoading(false)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedYear, selectedMonth])

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!monthlySummary) {
    return <div className="text-center py-12">No data available</div>
  }

  // Prepare bucket data for pie chart
  const bucketData = Object.entries(monthlySummary.bucket_breakdown || {}).map(([name, data]: [string, any]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),  // Capitalize bucket names
    value: data.amount,
    count: data.count
  }))

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
          "Click through to Transactions for detailed views"
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme">Dashboard</h1>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* Spending Velocity & Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Velocity */}
        {spendingVelocity && (
          <div className="card p-6">
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
        )}

        {/* Anomalies */}
        {anomalies && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-theme mb-4">Unusual Activity</h2>
            {anomalies.summary.total_anomalies === 0 ? (
              <p className="text-theme-muted text-center py-8">No unusual activity detected</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Link
                    href={`/transactions?amount_max=-100&start_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01&end_date=${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${new Date(selectedYear, selectedMonth, 0).getDate()}`}
                    className="bg-negative rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
                    title="View large transactions"
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
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bucket Breakdown Pie Chart */}
        <div className="card p-6">
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

        {/* Top Merchants */}
        <div className="card p-6">
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
      </div>

      {/* Trends Line Chart */}
      {trends && trends.data && trends.data.length > 0 && (
        <div className="card p-6">
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
      )}
    </div>
  )
}
