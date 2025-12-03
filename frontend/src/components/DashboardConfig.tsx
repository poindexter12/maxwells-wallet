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

interface DashboardConfigProps {
  widgets: Widget[]
  onToggleVisibility: (widgetId: number) => void
  onMoveUp: (widgetId: number) => void
  onMoveDown: (widgetId: number) => void
  onReset: () => void
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

export function DashboardConfig({
  widgets,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onReset
}: DashboardConfigProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position)

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
          <div className="absolute right-0 mt-2 w-72 bg-theme-elevated border border-theme rounded-lg shadow-xl z-50">
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
                Show/hide and reorder widgets
              </p>
            </div>

            <div className="p-2 max-h-80 overflow-y-auto">
              {sortedWidgets.map((widget, index) => (
                <div
                  key={widget.id}
                  className={`flex items-center gap-2 p-2 rounded ${
                    widget.is_visible ? 'bg-theme-subtle' : 'opacity-50'
                  }`}
                >
                  {/* Visibility toggle */}
                  <button
                    onClick={() => onToggleVisibility(widget.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                      widget.is_visible
                        ? 'bg-blue-500 text-white'
                        : 'border border-theme'
                    }`}
                    title={widget.is_visible ? 'Hide widget' : 'Show widget'}
                  >
                    {widget.is_visible && '✓'}
                  </button>

                  {/* Icon and title */}
                  <span className="text-lg">
                    {WIDGET_ICONS[widget.widget_type] || '📦'}
                  </span>
                  <span className="flex-1 text-sm text-theme truncate">
                    {widget.title || widget.widget_type}
                  </span>

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
              ))}
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
    </div>
  )
}
