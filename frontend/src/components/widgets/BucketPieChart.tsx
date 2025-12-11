'use client'

import { useTranslations } from 'next-intl'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useFormat } from '@/hooks/useFormat'
import { Widget, COLORS } from './types'

interface BucketPieChartProps {
  widget?: Widget
  bucketData: Array<{ name: string; value: number; count: number }>
}

export function BucketPieChart({ widget: _widget, bucketData }: BucketPieChartProps) {
  const t = useTranslations('dashboard.widgets')
  const { formatCurrency } = useFormat()

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{t('bucketPie')}</h2>
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
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-theme-muted text-center py-12">{t('noBucketData')}</p>
      )}
    </div>
  )
}
