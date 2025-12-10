'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

interface Widget {
  id: number
  widget_type: string
  title: string | null
  position: number
  width: string
  is_visible: boolean
  config: string | null
}

interface DashboardConfigProps {
  widgets: Widget[]
  onToggleVisibility: (widgetId: number) => void
  onMoveUp: (widgetId: number) => void
  onMoveDown: (widgetId: number) => void
}

const WIDGET_ICONS: Record<string, string> = {
  summary: '📊',
  velocity: '🔥',
  anomalies: '⚠️',
  bucket_pie: '🥧',
  top_merchants: '🏪',
  trends: '📈',
  sankey: '🌊',
  treemap: '🗺️',
  heatmap: '🗓️'
}

// Map widget_type to translation key (e.g., 'bucket_pie' -> 'bucketPie')
const WIDGET_TYPE_TO_KEY: Record<string, string> = {
  summary: 'summary',
  velocity: 'velocity',
  anomalies: 'anomalies',
  bucket_pie: 'bucketPie',
  top_merchants: 'topMerchants',
  trends: 'trends',
  sankey: 'sankey',
  treemap: 'treemap',
  heatmap: 'heatmap',
  budget_status: 'budgetStatus',
  credit_cards: 'creditCards',
  recurring: 'recurring'
}

export function DashboardConfig({
  widgets,
  onToggleVisibility,
  onMoveUp,
  onMoveDown
}: DashboardConfigProps) {
  const t = useTranslations('common')
  const tDash = useTranslations('dashboard')
  const tWidgets = useTranslations('dashboard.widgets')
  const [isOpen, setIsOpen] = useState(false)

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position)

  const parseConfig = (config: string | null): { buckets?: string[] } => {
    if (!config) return {}
    try {
      return JSON.parse(config)
    } catch {
      return {}
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-chaos-target="customize-dashboard"
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
        title={t('customize')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{t('customize')}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Config Panel */}
          <div className="absolute right-0 mt-2 w-72 bg-theme-elevated border border-theme rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-theme">
              <h3 className="font-medium text-theme">{tDash('quickWidgetToggle')}</h3>
              <p className="text-xs text-theme-muted mt-1">
                {tDash('quickWidgetToggleDescription')}
              </p>
            </div>

            <div className="p-2 max-h-80 overflow-y-auto">
              {sortedWidgets.map((widget, index) => {
                const config = parseConfig(widget.config)
                const hasFilter = config.buckets && config.buckets.length > 0

                return (
                  <div
                    key={widget.id}
                    className={`flex items-center gap-2 p-2 rounded ${
                      widget.is_visible ? 'bg-theme-subtle' : 'opacity-50'
                    }`}
                  >
                    {/* Visibility toggle */}
                    <button
                      onClick={() => onToggleVisibility(widget.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0 ${
                        widget.is_visible
                          ? 'bg-blue-500 text-white'
                          : 'border border-theme'
                      }`}
                      title={widget.is_visible ? tDash('hideWidget') : tDash('showWidget')}
                    >
                      {widget.is_visible && '✓'}
                    </button>

                    {/* Icon and title */}
                    <span className="text-lg">
                      {WIDGET_ICONS[widget.widget_type] || '📦'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-theme truncate block">
                        {widget.title || (WIDGET_TYPE_TO_KEY[widget.widget_type] ? tWidgets(WIDGET_TYPE_TO_KEY[widget.widget_type] as any) : widget.widget_type)}
                      </span>
                      {hasFilter && (
                        <span className="text-xs text-blue-500">{t('filter')}</span>
                      )}
                    </div>

                    {/* Reorder buttons */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => onMoveUp(widget.id)}
                        disabled={index === 0}
                        className="text-theme-muted hover:text-theme disabled:opacity-30 p-0.5"
                        title={tDash('moveUp')}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onMoveDown(widget.id)}
                        disabled={index === sortedWidgets.length - 1}
                        className="text-theme-muted hover:text-theme disabled:opacity-30 p-0.5"
                        title={tDash('moveDown')}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-3 border-t border-theme">
              <Link
                href="/dashboard/configure"
                className="flex items-center justify-center gap-2 w-full px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                onClick={() => setIsOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                {tDash('fullConfiguration')}
              </Link>
              <p className="text-xs text-theme-muted text-center mt-2">
                {tDash('fullConfigurationDescription')}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
