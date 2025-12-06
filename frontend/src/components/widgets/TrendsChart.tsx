'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/format'
import { Widget, TrendsData } from './types'

interface TrendsChartProps {
  widget?: Widget
  data: TrendsData | null
  isMonthlyScale: boolean
}

export function TrendsChart({ widget, data, isMonthlyScale }: TrendsChartProps) {
  if (!data || !data.data || data.data.length === 0) return null

  const isWeekly = data.group_by === 'week'
  const title = widget?.title || (isMonthlyScale ? '12-Week Trend' : '12-Month Trend')

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
          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
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
