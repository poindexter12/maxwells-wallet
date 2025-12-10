'use client'

import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'
import { Widget, HeatmapData, HeatmapDay, HeatmapMonth, HEATMAP_VARS } from './types'

interface SpendingHeatmapProps {
  widget?: Widget
  data: HeatmapData | null
  isMonthlyScale: boolean
  selectedYear: number
  selectedMonth: number
}

export function SpendingHeatmap({
  widget,
  data,
  isMonthlyScale,
  selectedYear,
  selectedMonth
}: SpendingHeatmapProps) {
  const t = useTranslations('dashboard.widgets')
  const title = widget?.title || t('heatmap')

  if (!data || !data.days) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        <p className="text-theme-muted text-center py-12">{t('noSpendingData')}</p>
      </div>
    )
  }

  // Yearly-scale view: show monthly grid
  if (!isMonthlyScale) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
        {data.summary && (
          <div className="flex gap-6 mb-4 text-sm">
            <div>
              <span className="text-theme-muted">{t('total')}: </span>
              <span className="font-semibold text-theme">{formatCurrency(data.summary.total_spending)}</span>
            </div>
            <div>
              <span className="text-theme-muted">{t('maxMonth')}: </span>
              <span className="font-semibold text-theme">{formatCurrency(data.summary.max_monthly || 0)}</span>
            </div>
            <div>
              <span className="text-theme-muted">{t('activeMonths')}: </span>
              <span className="font-semibold text-theme">{data.summary.months_with_spending || 0}</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
          {(data.days as HeatmapMonth[]).map((month) => {
            const colorVar = HEATMAP_VARS[Math.min(month.intensity, 5)]
            const useLightText = month.intensity >= 3

            return (
              <div
                key={month.month}
                className="rounded-lg p-3 flex flex-col items-center justify-center"
                style={{ backgroundColor: colorVar }}
                title={`${month.month_name}: ${formatCurrency(month.amount)} (${month.count} ${t('transactions').toLowerCase()})`}
              >
                <span
                  className="font-semibold text-sm"
                  style={{ color: useLightText ? 'var(--chart-text-light)' : 'var(--chart-text)' }}
                >
                  {month.month_name}
                </span>
                <span
                  className="text-xs mt-1"
                  style={{ color: useLightText ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}
                >
                  {formatCurrency(month.amount)}
                </span>
              </div>
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 text-xs text-theme-muted">
          <span>{t('heatmapLess')}</span>
          {HEATMAP_VARS.map((colorVar, i) => (
            <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: colorVar }} />
          ))}
          <span>{t('heatmapMore')}</span>
        </div>
      </div>
    )
  }

  // Month view: show daily calendar
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Organize days into weeks (7 columns)
  const days = data.days as HeatmapDay[]
  const firstDayWeekday = days[0]?.weekday ?? 0
  const paddedDays: (HeatmapDay | null)[] = [
    ...Array(firstDayWeekday).fill(null),
    ...days
  ]
  const weeks: (HeatmapDay | null)[][] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{title}</h2>
      {data.summary && (
        <div className="flex gap-6 mb-4 text-sm">
          <div>
            <span className="text-theme-muted">{t('total')}: </span>
            <span className="font-semibold text-theme">{formatCurrency(data.summary.total_spending)}</span>
          </div>
          <div>
            <span className="text-theme-muted">{t('maxDay')}: </span>
            <span className="font-semibold text-theme">{formatCurrency(data.summary.max_daily)}</span>
          </div>
          <div>
            <span className="text-theme-muted">{t('activeDays')}: </span>
            <span className="font-semibold text-theme">{data.summary.days_with_spending}</span>
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
              {week.map((day, dayIndex) => {
                const colorVar = day ? HEATMAP_VARS[Math.min(day.intensity, 5)] : 'transparent'
                const useLightText = day && day.intensity >= 3

                return (
                  <div
                    key={dayIndex}
                    className="w-10 h-10 rounded flex flex-col items-center justify-center text-xs"
                    style={{ backgroundColor: colorVar }}
                    title={day && !isNaN(selectedYear) && !isNaN(selectedMonth) ? `${format(new Date(selectedYear, selectedMonth - 1, day.day), 'MMM d')}: ${formatCurrency(day.amount)} (${day.count} ${t('transactions').toLowerCase()})` : ''}
                  >
                    {day && (
                      <>
                        <span
                          className="font-medium"
                          style={{ color: useLightText ? 'var(--chart-text-light)' : 'var(--chart-text)' }}
                        >
                          {day.day}
                        </span>
                        {day.amount > 0 && (
                          <span
                            className="text-[8px]"
                            style={{ color: useLightText ? 'rgba(255,255,255,0.8)' : 'var(--color-text-muted)' }}
                          >
                            ${Math.round(day.amount)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-4 text-xs text-theme-muted">
        <span>{t('heatmapLess')}</span>
        {HEATMAP_VARS.map((colorVar, i) => (
          <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: colorVar }} />
        ))}
        <span>{t('heatmapMore')}</span>
      </div>
    </div>
  )
}
