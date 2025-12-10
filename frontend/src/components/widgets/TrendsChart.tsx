'use client'

import { useTranslations } from 'next-intl'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useFormat } from '@/hooks/useFormat'
import { Widget, TrendsData } from './types'

interface TrendsChartProps {
  widget?: Widget
  data: TrendsData | null
  isMonthlyScale: boolean
}

export function TrendsChart({ widget, data, isMonthlyScale: _isMonthlyScale }: TrendsChartProps) {
  const t = useTranslations('dashboard.widgets')
  const { formatCurrency, formatCompactCurrency } = useFormat()

  if (!data || !data.data || data.data.length === 0) return null

  const isWeekly = data.group_by === 'week'
  const title = widget?.title || t('trends')

  const formatPeriodLabel = (period: string) => {
    if (isWeekly) {
      return period.split('-')[1] || period
    } else {
      const [, month] = period.split('-')
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return monthNames[parseInt(month) - 1] || period
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" tickFormatter={formatPeriodLabel} />
          <YAxis tickFormatter={(value) => formatCompactCurrency(value)} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => isWeekly ? `Week ${label.split('-')[1]?.replace('W', '') || label}` : formatPeriodLabel(label)}
          />
          <Legend />
          <Line type="monotone" dataKey="income" stroke="#10b981" name={t('income')} />
          <Line type="monotone" dataKey="expenses" stroke="#ef4444" name={t('expenses')} />
          <Line type="monotone" dataKey="net" stroke="#3b82f6" name={t('netLabel')} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
