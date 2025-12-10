'use client'

import { useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PageHelp } from '@/components/PageHelp'
import { DashboardConfig } from '@/components/DashboardConfig'
import DashboardTabs from '@/components/DashboardTabs'
import { useDashboard, DateRangeType } from '@/contexts/DashboardContext'
import { useWidgetManagement } from '@/hooks/useWidgetManagement'
import { LazyWidgetRenderer, Widget } from '@/components/widgets'

export default function Dashboard() {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const { currentDashboard, loading: dashboardLoading, updateDashboard } = useDashboard()
  const { widgets, fetchWidgets, toggleVisibility, moveUp, moveDown } = useWidgetManagement()

  // Date range options
  const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
    { value: 'mtd', label: t('dateRange.mtd') },
    { value: 'qtd', label: t('dateRange.qtd') },
    { value: 'ytd', label: t('dateRange.ytd') },
    { value: 'last_30_days', label: t('dateRange.last30Days') },
    { value: 'last_90_days', label: t('dateRange.last90Days') },
    { value: 'last_year', label: t('dateRange.lastYear') },
  ]

  // Extract date info from current dashboard
  const startDate = currentDashboard?.date_range?.start_date || ''
  const endDate = currentDashboard?.date_range?.end_date || ''

  // Fetch widgets when dashboard changes
  useEffect(() => {
    if (currentDashboard) {
      fetchWidgets()
    }
  }, [currentDashboard?.id, fetchWidgets])

  const handleDateRangeChange = useCallback(async (dateRangeType: DateRangeType) => {
    if (!currentDashboard) return
    await updateDashboard(currentDashboard.id, { date_range_type: dateRangeType })
  }, [currentDashboard, updateDashboard])

  // Show loading only for dashboard metadata, not widget data
  if (dashboardLoading) {
    return <div className="text-center py-12">{tCommon('loading')}</div>
  }

  if (!currentDashboard) {
    return <div className="text-center py-12">{t('noDashboard')}</div>
  }

  // Widget rendering - each widget fetches its own data
  const visibleWidgets = widgets
    .filter(w => w.is_visible)
    .sort((a, b) => a.position - b.position)

  const summaryWidget = visibleWidgets.find(w => w.widget_type === 'summary')
  const halfWidgets = visibleWidgets.filter(w => w.width === 'half' && w.widget_type !== 'summary')
  const fullWidgets = visibleWidgets.filter(w => w.width === 'full' && w.widget_type !== 'summary')

  const renderWidget = (widget: Widget) => (
    <LazyWidgetRenderer key={widget.id} widget={widget} />
  )

  return (
    <div className="space-y-8">
      <PageHelp pageId="dashboard" />

      <DashboardTabs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme">{t('title')}</h1>
          <p className="text-sm text-theme-muted mt-1">
            {startDate} to {endDate}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={currentDashboard.date_range_type}
            onChange={(e) => handleDateRangeChange(e.target.value as DateRangeType)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <DashboardConfig
            widgets={widgets}
            onToggleVisibility={toggleVisibility}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
          />
        </div>
      </div>

      {visibleWidgets.length === 0 ? (
        <div className="card p-12 text-center text-theme-muted">
          <p>{t('noWidgets')}</p>
        </div>
      ) : (
        <>
          {summaryWidget && renderWidget(summaryWidget)}

          {halfWidgets.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {halfWidgets.map(widget => renderWidget(widget))}
            </div>
          )}

          {fullWidgets.map(widget => renderWidget(widget))}
        </>
      )}
    </div>
  )
}
