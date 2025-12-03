'use client'

import { useState } from 'react'

interface Widget {
  id: number
  widget_type: string
  title: string | null
  position: number
  width: string
  is_visible: boolean
  config: string | null
}

interface Bucket {
  id: number
  value: string
}

interface WidgetConfig {
  buckets?: string[]
}

interface DashboardConfigProps {
  widgets: Widget[]
  availableBuckets: Bucket[]
  onToggleVisibility: (widgetId: number) => void
  onMoveUp: (widgetId: number) => void
  onMoveDown: (widgetId: number) => void
  onReset: () => void
  onDuplicate: (widgetId: number) => Promise<void>
  onUpdateWidget: (widgetId: number, title: string, config: WidgetConfig) => Promise<void>
  onDeleteWidget: (widgetId: number) => Promise<void>
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

// Widgets that support bucket filtering
const FILTERABLE_WIDGETS = ['top_merchants', 'trends', 'sankey', 'treemap', 'heatmap']

// Widgets that can be duplicated (for creating filtered views)
const DUPLICATABLE_WIDGETS = ['top_merchants', 'sankey', 'treemap', 'heatmap']

export function DashboardConfig({
  widgets,
  availableBuckets,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onReset,
  onDuplicate,
  onUpdateWidget,
  onDeleteWidget
}: DashboardConfigProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBuckets, setEditBuckets] = useState<string[]>([])

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position)

  const openEditModal = (widget: Widget) => {
    setEditingWidget(widget)
    setEditTitle(widget.title || '')
    const config: WidgetConfig = widget.config ? JSON.parse(widget.config) : {}
    setEditBuckets(config.buckets || [])
  }

  const saveWidgetConfig = async () => {
    if (!editingWidget) return
    const config: WidgetConfig = editBuckets.length > 0 ? { buckets: editBuckets } : {}
    await onUpdateWidget(editingWidget.id, editTitle, config)
    setEditingWidget(null)
  }

  const handleDuplicate = async (widgetId: number) => {
    await onDuplicate(widgetId)
  }

  const handleDelete = async (widgetId: number) => {
    if (confirm('Delete this widget?')) {
      await onDeleteWidget(widgetId)
    }
  }

  const parseConfig = (config: string | null): WidgetConfig => {
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
        className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
        title="Configure dashboard"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Customize</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Config Panel */}
          <div className="absolute right-0 mt-2 w-80 bg-theme-elevated border border-theme rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-theme">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-theme">Dashboard Widgets</h3>
                <button
                  onClick={onReset}
                  className="text-xs text-theme-muted hover:text-theme"
                >
                  Reset
                </button>
              </div>
              <p className="text-xs text-theme-muted mt-1">
                Configure, duplicate, and reorder widgets
              </p>
            </div>

            <div className="p-2 max-h-96 overflow-y-auto">
              {sortedWidgets.map((widget, index) => {
                const config = parseConfig(widget.config)
                const hasFilter = config.buckets && config.buckets.length > 0
                const isFilterable = FILTERABLE_WIDGETS.includes(widget.widget_type)
                const isDuplicatable = DUPLICATABLE_WIDGETS.includes(widget.widget_type)

                return (
                  <div
                    key={widget.id}
                    className={`flex items-center gap-2 p-2 rounded mb-1 ${
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
                      title={widget.is_visible ? 'Hide widget' : 'Show widget'}
                    >
                      {widget.is_visible && '✓'}
                    </button>

                    {/* Icon */}
                    <span className="text-lg flex-shrink-0">
                      {WIDGET_ICONS[widget.widget_type] || '📦'}
                    </span>

                    {/* Title and filter indicator */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-theme truncate block">
                        {widget.title || widget.widget_type}
                      </span>
                      {hasFilter && (
                        <span className="text-xs text-blue-500">
                          Filtered: {config.buckets!.join(', ')}
                        </span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Settings button for filterable widgets */}
                      {isFilterable && (
                        <button
                          onClick={() => openEditModal(widget)}
                          className={`p-1 rounded hover:bg-[var(--color-bg-hover)] ${
                            hasFilter ? 'text-blue-500' : 'text-theme-muted'
                          }`}
                          title="Configure widget"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                        </button>
                      )}

                      {/* Duplicate button */}
                      {isDuplicatable && (
                        <button
                          onClick={() => handleDuplicate(widget.id)}
                          className="p-1 rounded text-theme-muted hover:text-theme hover:bg-[var(--color-bg-hover)]"
                          title="Duplicate widget"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}

                      {/* Delete button for duplicated widgets (not default ones) */}
                      {widget.title?.includes('(copy)') && (
                        <button
                          onClick={() => handleDelete(widget.id)}
                          className="p-1 rounded text-theme-muted hover:text-red-500 hover:bg-[var(--color-bg-hover)]"
                          title="Delete widget"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}

                      {/* Reorder buttons */}
                      <div className="flex flex-col">
                        <button
                          onClick={() => onMoveUp(widget.id)}
                          disabled={index === 0}
                          className="text-theme-muted hover:text-theme disabled:opacity-30 p-0.5"
                          title="Move up"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => onMoveDown(widget.id)}
                          disabled={index === sortedWidgets.length - 1}
                          className="text-theme-muted hover:text-theme disabled:opacity-30 p-0.5"
                          title="Move down"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-2 border-t border-theme text-center">
              <button
                onClick={() => setIsOpen(false)}
                className="text-sm text-theme-muted hover:text-theme"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Widget Modal */}
      {editingWidget && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setEditingWidget(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-theme-elevated border border-theme rounded-lg shadow-xl z-50 p-4">
            <h3 className="text-lg font-semibold text-theme mb-4">
              Configure {WIDGET_ICONS[editingWidget.widget_type]} {editingWidget.widget_type}
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={editingWidget.widget_type}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme text-theme"
                />
              </div>

              {/* Bucket Filter */}
              {FILTERABLE_WIDGETS.includes(editingWidget.widget_type) && availableBuckets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">
                    Filter by Buckets
                  </label>
                  <p className="text-xs text-theme-muted mb-2">
                    Leave empty to show all buckets
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-theme rounded-md p-2">
                    {availableBuckets.map((bucket) => (
                      <label
                        key={bucket.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editBuckets.includes(bucket.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditBuckets([...editBuckets, bucket.value])
                            } else {
                              setEditBuckets(editBuckets.filter(b => b !== bucket.value))
                            }
                          }}
                          className="rounded border-theme text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-theme capitalize">{bucket.value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingWidget(null)}
                className="px-4 py-2 text-sm text-theme-muted hover:text-theme"
              >
                Cancel
              </button>
              <button
                onClick={saveWidgetConfig}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
