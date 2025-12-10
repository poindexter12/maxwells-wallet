'use client'

import { useTranslations } from 'next-intl'
import { useFormat } from '@/hooks/useFormat'
import { SummaryData, MonthOverMonthData } from './types'
import { TEST_IDS } from '@/test-ids'

interface SummaryCardsProps {
  summary: SummaryData
  monthOverMonth?: MonthOverMonthData | null
}

export function SummaryCards({ summary, monthOverMonth }: SummaryCardsProps) {
  const t = useTranslations('dashboard.summary')
  const { formatCurrency } = useFormat()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid={TEST_IDS.WIDGET_SUMMARY_CARDS}>
      <div className="card p-6" data-testid={TEST_IDS.WIDGET_SUMMARY_INCOME}>
        <p className="text-sm font-medium text-theme-muted">{t('totalIncome')}</p>
        <p className="mt-2 text-3xl font-bold text-positive" data-testid={TEST_IDS.WIDGET_SUMMARY_INCOME_VALUE}>
          {formatCurrency(summary.total_income)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.income.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.income.amount >= 0 ? '+' : ''}{monthOverMonth.changes.income.percent.toFixed(1)}% {t('vsLastMonth')}
          </p>
        )}
      </div>
      <div className="card p-6" data-testid={TEST_IDS.WIDGET_SUMMARY_EXPENSES}>
        <p className="text-sm font-medium text-theme-muted">{t('totalExpenses')}</p>
        <p className="mt-2 text-3xl font-bold text-negative" data-testid={TEST_IDS.WIDGET_SUMMARY_EXPENSES_VALUE}>
          {formatCurrency(summary.total_expenses)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.expenses.amount < 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.expenses.amount >= 0 ? '+' : ''}{monthOverMonth.changes.expenses.percent.toFixed(1)}% {t('vsLastMonth')}
          </p>
        )}
      </div>
      <div className="card p-6" data-testid={TEST_IDS.WIDGET_SUMMARY_NET}>
        <p className="text-sm font-medium text-theme-muted">{t('net')}</p>
        <p className={`mt-2 text-3xl font-bold ${summary.net >= 0 ? 'text-positive' : 'text-negative'}`} data-testid={TEST_IDS.WIDGET_SUMMARY_NET_VALUE}>
          {formatCurrency(summary.net)}
        </p>
        {monthOverMonth && (
          <p className={`mt-2 text-sm ${monthOverMonth.changes.net.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
            {monthOverMonth.changes.net.amount >= 0 ? '+' : ''}{monthOverMonth.changes.net.percent.toFixed(1)}% {t('vsLastMonth')}
          </p>
        )}
      </div>
    </div>
  )
}
