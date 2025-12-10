'use client'

import { useTranslations } from 'next-intl'
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
  const t = useTranslations('dashboard.widgets')

  const now = new Date()
  // Guard against invalid year values
  const safeYear = !isNaN(selectedYear) ? selectedYear : now.getFullYear()

  // Yearly-scale view: show annual velocity from summary
  if (!isMonthlyScale && summary) {
    const daysInYear = safeYear === now.getFullYear()
      ? Math.floor((now.getTime() - new Date(safeYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)) + 1
      : (safeYear % 4 === 0 ? 366 : 365)
    const daysTotal = safeYear % 4 === 0 ? 366 : 365

    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{t('velocity')}</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-theme-muted">{t('dailyAverage')}</p>
            <p className="text-2xl font-bold text-theme">{formatCurrency(summary.daily_average || 0)}{t('perDay')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-muted">{t('daysElapsed')}</p>
              <p className="text-lg font-semibold text-theme">{summary.days_elapsed || daysInYear} / {daysTotal}</p>
            </div>
            <div>
              <p className="text-sm text-theme-muted">{t('totalSpending')}</p>
              <p className="text-lg font-semibold text-theme">{formatCurrency(summary.total_expenses)}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-theme-muted">{t('transactions')}</p>
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
      <h2 className="text-lg font-semibold text-theme mb-4">{t('velocity')}</h2>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-theme-muted">{t('dailySpendingRate')}</p>
          <p className="text-2xl font-bold text-theme">{spendingVelocity.insights.daily_burn_rate}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-theme-muted">{t('daysElapsed')}</p>
            <p className="text-lg font-semibold text-theme">{spendingVelocity.days_elapsed} / {spendingVelocity.days_in_month}</p>
          </div>
          <div>
            <p className="text-sm text-theme-muted">{t('daysRemaining')}</p>
            <p className="text-lg font-semibold text-theme">{spendingVelocity.insights.days_remaining}</p>
          </div>
        </div>
        <div>
          <p className="text-sm text-theme-muted">{t('projectedMonthTotal')}</p>
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
                {spendingVelocity.pace === 'over_budget' ? t('overBudget') :
                 spendingVelocity.pace === 'under_budget' ? t('underBudget') :
                 t('onTrack')}
              </span>
            </div>
          </div>
        </div>
        <div className="text-xs text-theme-muted">
          <p>{t('projectedRemaining')}: {formatCurrency(spendingVelocity.insights.projected_remaining_spending)}</p>
          <p>{t('previousMonth')}: {formatCurrency(spendingVelocity.previous_month.expenses)}</p>
        </div>
      </div>
    </div>
  )
}
