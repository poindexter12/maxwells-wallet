'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'

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
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch current month summary
        const summaryRes = await fetch(`/api/v1/reports/monthly-summary?year=${currentYear}&month=${currentMonth}`)
        const summaryData = await summaryRes.json()
        setMonthlySummary(summaryData)

        // Fetch 6-month trends
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        const trendsRes = await fetch(
          `/api/v1/reports/trends?start_date=${format(sixMonthsAgo, 'yyyy-MM-dd')}&end_date=${format(now, 'yyyy-MM-dd')}&group_by=month`
        )
        const trendsData = await trendsRes.json()
        setTrends(trendsData)

        // Fetch top merchants
        const merchantsRes = await fetch('/api/v1/reports/top-merchants?limit=10&period=current_month')
        const merchantsData = await merchantsRes.json()
        setTopMerchants(merchantsData)

        // Fetch month-over-month comparison
        const momRes = await fetch(`/api/v1/reports/month-over-month?current_year=${currentYear}&current_month=${currentMonth}`)
        const momData = await momRes.json()
        setMonthOverMonth(momData)

        // Fetch spending velocity
        const velocityRes = await fetch(`/api/v1/reports/spending-velocity?year=${currentYear}&month=${currentMonth}`)
        const velocityData = await velocityRes.json()
        setSpendingVelocity(velocityData)

        // Fetch anomalies
        const anomaliesRes = await fetch(`/api/v1/reports/anomalies?year=${currentYear}&month=${currentMonth}&threshold=2.0`)
        const anomaliesData = await anomaliesRes.json()
        setAnomalies(anomaliesData)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [currentYear, currentMonth])

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (!monthlySummary) {
    return <div className="text-center py-12">No data available</div>
  }

  // Prepare category data for pie chart
  const categoryData = Object.entries(monthlySummary.category_breakdown || {}).map(([name, data]: [string, any]) => ({
    name,
    value: data.amount,
    count: data.count
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Viewing {format(new Date(currentYear, currentMonth - 1), 'MMMM yyyy')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Income</p>
          <p className="mt-2 text-3xl font-bold text-green-600">
            ${monthlySummary.total_income.toFixed(2)}
          </p>
          {monthOverMonth && (
            <p className={`mt-2 text-sm ${monthOverMonth.changes.income.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthOverMonth.changes.income.amount >= 0 ? '+' : ''}{monthOverMonth.changes.income.percent.toFixed(1)}% vs last month
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Expenses</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            ${monthlySummary.total_expenses.toFixed(2)}
          </p>
          {monthOverMonth && (
            <p className={`mt-2 text-sm ${monthOverMonth.changes.expenses.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthOverMonth.changes.expenses.amount >= 0 ? '+' : ''}{monthOverMonth.changes.expenses.percent.toFixed(1)}% vs last month
            </p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Net</p>
          <p className={`mt-2 text-3xl font-bold ${monthlySummary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${monthlySummary.net.toFixed(2)}
          </p>
          {monthOverMonth && (
            <p className={`mt-2 text-sm ${monthOverMonth.changes.net.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {monthOverMonth.changes.net.amount >= 0 ? '+' : ''}{monthOverMonth.changes.net.percent.toFixed(1)}% vs last month
            </p>
          )}
        </div>
      </div>

      {/* Spending Velocity & Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Velocity */}
        {spendingVelocity && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Burn Rate</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Daily Spending Rate</p>
                <p className="text-2xl font-bold text-gray-900">{spendingVelocity.insights.daily_burn_rate}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Days Elapsed</p>
                  <p className="text-lg font-semibold">{spendingVelocity.days_elapsed} / {spendingVelocity.days_in_month}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Days Remaining</p>
                  <p className="text-lg font-semibold">{spendingVelocity.insights.days_remaining}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Projected Month Total</p>
                <p className="text-xl font-bold text-gray-900">${spendingVelocity.projected_monthly.expenses.toFixed(2)}</p>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          spendingVelocity.pace === 'over_budget' ? 'bg-red-600' :
                          spendingVelocity.pace === 'under_budget' ? 'bg-green-600' :
                          'bg-blue-600'
                        }`}
                        style={{ width: `${(spendingVelocity.days_elapsed / spendingVelocity.days_in_month) * 100}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${
                      spendingVelocity.pace === 'over_budget' ? 'text-red-600' :
                      spendingVelocity.pace === 'under_budget' ? 'text-green-600' :
                      'text-blue-600'
                    }`}>
                      {spendingVelocity.pace === 'over_budget' ? 'Over Budget' :
                       spendingVelocity.pace === 'under_budget' ? 'Under Budget' :
                       'On Track'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                <p>Projected remaining: ${spendingVelocity.insights.projected_remaining_spending.toFixed(2)}</p>
                <p>Previous month: ${spendingVelocity.previous_month.expenses.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Anomalies */}
        {anomalies && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Unusual Activity</h2>
            {anomalies.summary.total_anomalies === 0 ? (
              <p className="text-gray-500 text-center py-8">No unusual activity detected</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-red-50 rounded p-2">
                    <p className="text-2xl font-bold text-red-600">{anomalies.summary.large_transaction_count}</p>
                    <p className="text-xs text-gray-600">Large</p>
                  </div>
                  <div className="bg-blue-50 rounded p-2">
                    <p className="text-2xl font-bold text-blue-600">{anomalies.summary.new_merchant_count}</p>
                    <p className="text-xs text-gray-600">New</p>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <p className="text-2xl font-bold text-orange-600">{anomalies.summary.unusual_category_count}</p>
                    <p className="text-xs text-gray-600">Category</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {anomalies.anomalies.large_transactions.slice(0, 3).map((txn: any, idx: number) => (
                    <div key={`large-${idx}`} className="border-l-4 border-red-500 pl-3 py-1">
                      <p className="text-sm font-medium">${txn.amount.toFixed(2)} - {txn.merchant}</p>
                      <p className="text-xs text-gray-600">{txn.reason}</p>
                    </div>
                  ))}
                  {anomalies.anomalies.new_merchants.slice(0, 3).map((txn: any, idx: number) => (
                    <div key={`new-${idx}`} className="border-l-4 border-blue-500 pl-3 py-1">
                      <p className="text-sm font-medium">${txn.amount.toFixed(2)} - {txn.merchant}</p>
                      <p className="text-xs text-gray-600">{txn.reason}</p>
                    </div>
                  ))}
                  {anomalies.anomalies.unusual_categories.slice(0, 2).map((cat: any, idx: number) => (
                    <div key={`cat-${idx}`} className="border-l-4 border-orange-500 pl-3 py-1">
                      <p className="text-sm font-medium">{cat.category}</p>
                      <p className="text-xs text-gray-600">{cat.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No category data available</p>
          )}
        </div>

        {/* Top Merchants */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top Merchants</h2>
          {topMerchants && topMerchants.merchants.length > 0 ? (
            <div className="space-y-3">
              {topMerchants.merchants.slice(0, 10).map((merchant: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">{merchant.merchant}</span>
                  <span className="text-sm font-semibold text-gray-900">
                    ${merchant.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-12">No merchant data available</p>
          )}
        </div>
      </div>

      {/* Trends Line Chart */}
      {trends && trends.data && trends.data.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">6-Month Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value: any) => `$${value.toFixed(2)}`} />
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
