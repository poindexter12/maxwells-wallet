'use client'

import { formatCurrency } from '@/lib/format'
import { SummaryData, SpendingVelocityData } from './types'

interface SpendingVelocityProps {
  isMonthlyScale: boolean
  summary: SummaryData
  spendingVelocity?: SpendingVelocityData | null
  selectedYear: number
}

export function SpendingVelocity({
  isMonthlyScale,
  summary,
  spendingVelocity,
  selectedYear
}: SpendingVelocityProps) {
  const now = new Date()

  // Yearly-scale view: show annual velocity from summary
  if (!isMonthlyScale && summary) {
    const daysInYear = selectedYear === now.getFullYear()
      ? Math.floor((now.getTime() - new Date(selectedYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : (selectedYear % 4 === 0 ? 366 : 365)
    const daysTotal = selectedYear % 4 === 0 ? 366 : 365

    return (
      <div className="card p-6">
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
  )
}
