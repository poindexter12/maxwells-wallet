'use client'

import { useTranslations } from 'next-intl'
import { Widget, WidgetConfig, WIDGET_INFO } from '@/types/dashboard'

interface WidgetRowProps {
  widget: Widget
  index: number
  isFirst: boolean
  isLast: boolean
  config: WidgetConfig
  onMoveUp: (id: number) => void
  onMoveDown: (id: number) => void
  onToggleVisibility: (id: number) => void
  onEdit: (widget: Widget) => void
  onDuplicate: (id: number) => void
  onDelete: (id: number) => void
}

export function WidgetRow({
  widget,
  index,
  isFirst,
  isLast,
  config,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onEdit,
  onDuplicate,
  onDelete
}: WidgetRowProps) {
  const t = useTranslations('dashboard.widgets')
  const info = WIDGET_INFO[widget.widget_type] || {
    icon: '📦',
    nameKey: widget.widget_type,
    descriptionKey: widget.widget_type,
    supportsFilter: false,
    canDuplicate: false
  }

  // Get translated name and description
  const widgetName = t(info.nameKey as 'summary')
  const widgetDescription = t(`descriptions.${info.descriptionKey}` as 'descriptions.summary')

  const hasBucketFilter = config.buckets && config.buckets.length > 0
  const hasAccountFilter = config.accounts && config.accounts.length > 0
  const hasMerchantFilter = config.merchants && config.merchants.length > 0
  const hasFilter = hasBucketFilter || hasAccountFilter || hasMerchantFilter
  // Widget is "customized" if it has any filters applied
  const isCustomized = hasFilter

  return (
    <div
      className={`p-4 flex items-start gap-4 ${!widget.is_visible ? 'opacity-50 bg-theme-subtle' : ''}`}
    >
      {/* Position & Visibility */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          onClick={() => onMoveUp(widget.id)}
          disabled={isFirst}
          className="p-1 text-theme-muted hover:text-theme disabled:opacity-30"
          title="Move up"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <span className="text-xs text-theme-muted font-mono">{index + 1}</span>
        <button
          onClick={() => onMoveDown(widget.id)}
          disabled={isLast}
          className="p-1 text-theme-muted hover:text-theme disabled:opacity-30"
          title="Move down"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Visibility Toggle */}
      <button
        onClick={() => onToggleVisibility(widget.id)}
        className={`mt-1 w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0 ${
          widget.is_visible
            ? 'bg-blue-500 text-white'
            : 'border border-theme text-theme-muted'
        }`}
        title={widget.is_visible ? 'Click to hide' : 'Click to show'}
      >
        {widget.is_visible ? '✓' : ''}
      </button>

      {/* Icon */}
      <span className="text-2xl mt-0.5">{info.icon}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-theme">
            {widget.title || widgetName}
          </h3>
          {info.supportsFilter && (
            <span className="text-blue-500" title="Supports bucket filtering">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </span>
          )}
          {isCustomized && (
            <span className="text-xs px-2 py-0.5 bg-theme-subtle rounded text-theme-muted">
              {t('customLabel')}
            </span>
          )}
        </div>
        <p className="text-sm text-theme-muted mt-0.5">{widgetDescription}</p>
        {hasFilter && (
          <div className="flex flex-wrap gap-2 mt-1">
            {hasBucketFilter && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                {t('filterBuckets', { buckets: config.buckets!.join(', ') })}
              </span>
            )}
            {hasAccountFilter && (
              <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
                {t('filterAccounts', { accounts: config.accounts!.join(', ') })}
              </span>
            )}
            {hasMerchantFilter && (
              <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded">
                {t('filterMerchants', { merchants: config.merchants!.join(', ') })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {info.supportsFilter && (
          <button
            onClick={() => onEdit(widget)}
            className={`p-2 rounded hover:bg-[var(--color-bg-hover)] ${
              hasFilter ? 'text-blue-500' : 'text-theme-muted'
            }`}
            title="Configure widget"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
        {info.canDuplicate && (
          <button
            onClick={() => onDuplicate(widget.id)}
            className="p-2 rounded text-theme-muted hover:text-theme hover:bg-[var(--color-bg-hover)]"
            title="Duplicate widget"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
        {isCustomized && (
          <button
            onClick={() => onDelete(widget.id)}
            className="p-2 rounded text-theme-muted hover:text-red-500 hover:bg-[var(--color-bg-hover)]"
            title="Delete widget"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
