'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHelp } from '@/components/PageHelp'

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

interface FilterOption {
  value: string
  count: number
}

interface WidgetConfig {
  buckets?: string[]
  accounts?: string[]
  merchants?: string[]
}

// Widget metadata for descriptions and help
const WIDGET_INFO: Record<string, {
  icon: string
  name: string
  description: string
  supportsFilter: boolean
  canDuplicate: boolean
}> = {
  summary: {
    icon: '📊',
    name: 'Summary',
    description: 'Shows total income, expenses, and net for the period. Includes month-over-month comparison.',
    supportsFilter: false,
    canDuplicate: false
  },
  velocity: {
    icon: '🔥',
    name: 'Spending Velocity',
    description: 'Daily burn rate showing if you\'re on track for your typical monthly spending.',
    supportsFilter: false,
    canDuplicate: false
  },
  anomalies: {
    icon: '⚠️',
    name: 'Anomalies',
    description: 'Highlights unusual transactions that deviate significantly from your normal spending patterns.',
    supportsFilter: false,
    canDuplicate: false
  },
  bucket_pie: {
    icon: '🥧',
    name: 'Spending by Bucket',
    description: 'Pie chart showing how spending is distributed across your budget buckets.',
    supportsFilter: false,
    canDuplicate: false
  },
  top_merchants: {
    icon: '🏪',
    name: 'Top Merchants',
    description: 'List of merchants where you spend the most. Can be filtered by bucket to see top merchants within a category.',
    supportsFilter: true,
    canDuplicate: true
  },
  trends: {
    icon: '📈',
    name: 'Trends',
    description: 'Line chart showing income, expenses, and net over time. Shows 12 weeks in month view, 12 months in year view.',
    supportsFilter: true,
    canDuplicate: false
  },
  sankey: {
    icon: '🌊',
    name: 'Money Flow',
    description: 'Flow diagram showing how money moves from income sources through accounts to spending categories. Great for understanding overall cash flow.',
    supportsFilter: true,
    canDuplicate: true
  },
  treemap: {
    icon: '🗺️',
    name: 'Spending Breakdown',
    description: 'Hierarchical view of spending by category and merchant. Larger boxes = more spending. Click to explore.',
    supportsFilter: true,
    canDuplicate: true
  },
  heatmap: {
    icon: '🗓️',
    name: 'Spending Calendar',
    description: 'Calendar heatmap showing daily spending intensity. Darker = more spent. Click months in year view to drill down.',
    supportsFilter: true,
    canDuplicate: true
  }
}

export default function DashboardConfigurePage() {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [availableBuckets, setAvailableBuckets] = useState<Bucket[]>([])
  const [availableAccounts, setAvailableAccounts] = useState<FilterOption[]>([])
  const [availableMerchants, setAvailableMerchants] = useState<FilterOption[]>([])
  const [loading, setLoading] = useState(true)
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBuckets, setEditBuckets] = useState<string[]>([])
  const [editAccounts, setEditAccounts] = useState<string[]>([])
  const [editMerchants, setEditMerchants] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWidgets()
    fetchBuckets()
    fetchFilterOptions()
  }, [])

  async function fetchWidgets() {
    try {
      const res = await fetch('/api/v1/dashboard/widgets')
      if (res.ok) {
        const data = await res.json()
        setWidgets(data)
      }
    } catch (error) {
      console.error('Error fetching widgets:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchBuckets() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      if (res.ok) {
        const data = await res.json()
        setAvailableBuckets(data)
      }
    } catch (error) {
      console.error('Error fetching buckets:', error)
    }
  }

  async function fetchFilterOptions() {
    try {
      const res = await fetch('/api/v1/reports/filter-options')
      if (res.ok) {
        const data = await res.json()
        setAvailableAccounts(data.accounts || [])
        setAvailableMerchants(data.merchants || [])
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  async function handleToggleVisibility(widgetId: number) {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}/visibility`, { method: 'PATCH' })
      fetchWidgets()
    } catch (error) {
      console.error('Error toggling visibility:', error)
    }
  }

  async function handleMoveUp(widgetId: number) {
    const sorted = [...widgets].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex(w => w.id === widgetId)
    if (index <= 0) return

    const updates = [
      { id: sorted[index].id, position: sorted[index - 1].position },
      { id: sorted[index - 1].id, position: sorted[index].position }
    ]

    try {
      await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      })
      fetchWidgets()
    } catch (error) {
      console.error('Error reordering:', error)
    }
  }

  async function handleMoveDown(widgetId: number) {
    const sorted = [...widgets].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex(w => w.id === widgetId)
    if (index < 0 || index >= sorted.length - 1) return

    const updates = [
      { id: sorted[index].id, position: sorted[index + 1].position },
      { id: sorted[index + 1].id, position: sorted[index].position }
    ]

    try {
      await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      })
      fetchWidgets()
    } catch (error) {
      console.error('Error reordering:', error)
    }
  }

  async function handleDuplicate(widgetId: number) {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}/duplicate`, { method: 'POST' })
      fetchWidgets()
    } catch (error) {
      console.error('Error duplicating widget:', error)
    }
  }

  async function handleDelete(widgetId: number) {
    if (!confirm('Delete this widget? This cannot be undone.')) return
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}`, { method: 'DELETE' })
      fetchWidgets()
    } catch (error) {
      console.error('Error deleting widget:', error)
    }
  }

  async function handleReset() {
    if (!confirm('Reset dashboard to defaults? All customizations will be lost.')) return
    try {
      await fetch('/api/v1/dashboard/reset', { method: 'POST' })
      fetchWidgets()
    } catch (error) {
      console.error('Error resetting:', error)
    }
  }

  function openEditModal(widget: Widget) {
    setEditingWidget(widget)
    setEditTitle(widget.title || '')
    const config: WidgetConfig = widget.config ? JSON.parse(widget.config) : {}
    setEditBuckets(config.buckets || [])
    setEditAccounts(config.accounts || [])
    setEditMerchants(config.merchants || [])
  }

  async function saveWidgetConfig() {
    if (!editingWidget) return
    setSaving(true)
    try {
      const config: WidgetConfig = {}
      if (editBuckets.length > 0) config.buckets = editBuckets
      if (editAccounts.length > 0) config.accounts = editAccounts
      if (editMerchants.length > 0) config.merchants = editMerchants

      await fetch(`/api/v1/dashboard/widgets/${editingWidget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle || null,
          config: Object.keys(config).length > 0 ? JSON.stringify(config) : null
        })
      })
      fetchWidgets()
      setEditingWidget(null)
    } catch (error) {
      console.error('Error saving widget:', error)
    } finally {
      setSaving(false)
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

  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position)

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="dashboard-configure"
        title="Dashboard Configuration"
        description="Customize which widgets appear on your dashboard, their order, and configure filtered views."
        tips={[
          "Toggle visibility to show/hide widgets on the dashboard",
          "Use the arrows to reorder widgets",
          "Duplicate widgets to create filtered views (e.g., 'Groceries Spending' treemap)",
          "Configure bucket filters to focus widgets on specific spending categories"
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme">Configure Dashboard</h1>
          <p className="text-theme-muted mt-1">
            Customize your dashboard layout and create filtered widget views
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-red-500 hover:text-red-600 border border-red-500 rounded-md hover:bg-red-500/10"
          >
            Reset to Defaults
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Help Section */}
      <div className="card p-6 bg-blue-500/5 border-blue-500/20">
        <h2 className="text-lg font-semibold text-theme mb-3">How Widget Filtering Works</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-theme-muted">
          <div>
            <h3 className="font-medium text-theme mb-1">Creating Filtered Views</h3>
            <p>
              Duplicate widgets to create focused views. For example, duplicate the treemap
              and filter it to show only "Groceries" spending.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-theme mb-1">Filter Types</h3>
            <p>
              Filter by <strong>bucket</strong> (spending category), <strong>account</strong> (credit card, bank),
              or <strong>merchant</strong> (specific stores).
            </p>
          </div>
          <div>
            <h3 className="font-medium text-theme mb-1">Supported Widgets</h3>
            <p>
              Widgets marked with a <span className="text-blue-500">filter icon</span> support filtering.
              Click the settings button to configure.
            </p>
          </div>
        </div>
      </div>

      {/* Widget List */}
      <div className="card">
        <div className="p-4 border-b border-theme">
          <h2 className="text-lg font-semibold text-theme">Your Widgets</h2>
          <p className="text-sm text-theme-muted">Drag to reorder, toggle visibility, or configure filters</p>
        </div>

        <div className="divide-y divide-theme">
          {sortedWidgets.map((widget, index) => {
            const info = WIDGET_INFO[widget.widget_type] || {
              icon: '📦',
              name: widget.widget_type,
              description: 'Custom widget',
              supportsFilter: false,
              canDuplicate: false
            }
            const config = parseConfig(widget.config)
            const hasBucketFilter = config.buckets && config.buckets.length > 0
            const hasAccountFilter = config.accounts && config.accounts.length > 0
            const hasMerchantFilter = config.merchants && config.merchants.length > 0
            const hasFilter = hasBucketFilter || hasAccountFilter || hasMerchantFilter
            const isDuplicate = widget.title?.includes('(copy)') || hasFilter

            return (
              <div
                key={widget.id}
                className={`p-4 flex items-start gap-4 ${!widget.is_visible ? 'opacity-50 bg-theme-subtle' : ''}`}
              >
                {/* Position & Visibility */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <button
                    onClick={() => handleMoveUp(widget.id)}
                    disabled={index === 0}
                    className="p-1 text-theme-muted hover:text-theme disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <span className="text-xs text-theme-muted font-mono">{index + 1}</span>
                  <button
                    onClick={() => handleMoveDown(widget.id)}
                    disabled={index === sortedWidgets.length - 1}
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
                  onClick={() => handleToggleVisibility(widget.id)}
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
                      {widget.title || info.name}
                    </h3>
                    {info.supportsFilter && (
                      <span className="text-blue-500" title="Supports bucket filtering">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      </span>
                    )}
                    {isDuplicate && (
                      <span className="text-xs px-2 py-0.5 bg-theme-subtle rounded text-theme-muted">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-theme-muted mt-0.5">{info.description}</p>
                  {hasFilter && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {hasBucketFilter && (
                        <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                          Buckets: {config.buckets!.join(', ')}
                        </span>
                      )}
                      {hasAccountFilter && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
                          Accounts: {config.accounts!.join(', ')}
                        </span>
                      )}
                      {hasMerchantFilter && (
                        <span className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-500 rounded">
                          Merchants: {config.merchants!.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {info.supportsFilter && (
                    <button
                      onClick={() => openEditModal(widget)}
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
                      onClick={() => handleDuplicate(widget.id)}
                      className="p-2 rounded text-theme-muted hover:text-theme hover:bg-[var(--color-bg-hover)]"
                      title="Duplicate widget"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  )}
                  {isDuplicate && (
                    <button
                      onClick={() => handleDelete(widget.id)}
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
          })}
        </div>
      </div>

      {/* Widget Type Reference */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">Widget Reference</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(WIDGET_INFO).map(([type, info]) => (
            <div key={type} className="p-3 rounded-lg bg-theme-subtle">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{info.icon}</span>
                <span className="font-medium text-theme">{info.name}</span>
              </div>
              <p className="text-xs text-theme-muted">{info.description}</p>
              <div className="flex gap-2 mt-2">
                {info.supportsFilter && (
                  <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">
                    Filterable
                  </span>
                )}
                {info.canDuplicate && (
                  <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">
                    Duplicatable
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Widget Modal */}
      {editingWidget && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setEditingWidget(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-theme-elevated border border-theme rounded-lg shadow-xl z-50 p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-theme mb-4">
              Configure {WIDGET_INFO[editingWidget.widget_type]?.icon} {WIDGET_INFO[editingWidget.widget_type]?.name || editingWidget.widget_type}
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  Custom Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={WIDGET_INFO[editingWidget.widget_type]?.name || editingWidget.widget_type}
                  className="w-full px-3 py-2 border border-theme rounded-md bg-theme text-theme"
                />
                <p className="text-xs text-theme-muted mt-1">
                  Leave empty to use the default title
                </p>
              </div>

              {/* Filter Sections - only show for filterable widgets */}
              {WIDGET_INFO[editingWidget.widget_type]?.supportsFilter && (
                <div className="space-y-4">
                  {/* Bucket Filter */}
                  {availableBuckets.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-theme mb-1">
                        Filter by Buckets
                      </label>
                      <p className="text-xs text-theme-muted mb-2">
                        Show only transactions in selected categories.
                      </p>
                      <div className="max-h-32 overflow-y-auto border border-theme rounded-md p-2">
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

                  {/* Account Filter */}
                  {availableAccounts.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-theme mb-1">
                        Filter by Accounts
                      </label>
                      <p className="text-xs text-theme-muted mb-2">
                        Show only transactions from selected accounts.
                      </p>
                      <div className="max-h-32 overflow-y-auto border border-theme rounded-md p-2">
                        {availableAccounts.map((account) => (
                          <label
                            key={account.value}
                            className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editAccounts.includes(account.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditAccounts([...editAccounts, account.value])
                                  } else {
                                    setEditAccounts(editAccounts.filter(a => a !== account.value))
                                  }
                                }}
                                className="rounded border-theme text-green-500 focus:ring-green-500"
                              />
                              <span className="text-sm text-theme">{account.value}</span>
                            </div>
                            <span className="text-xs text-theme-muted">{account.count}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Merchant Filter */}
                  {availableMerchants.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-theme mb-1">
                        Filter by Merchants
                      </label>
                      <p className="text-xs text-theme-muted mb-2">
                        Show only transactions from selected merchants.
                      </p>
                      <div className="max-h-32 overflow-y-auto border border-theme rounded-md p-2">
                        {availableMerchants.slice(0, 50).map((merchant) => (
                          <label
                            key={merchant.value}
                            className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editMerchants.includes(merchant.value)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditMerchants([...editMerchants, merchant.value])
                                  } else {
                                    setEditMerchants(editMerchants.filter(m => m !== merchant.value))
                                  }
                                }}
                                className="rounded border-theme text-purple-500 focus:ring-purple-500"
                              />
                              <span className="text-sm text-theme">{merchant.value}</span>
                            </div>
                            <span className="text-xs text-theme-muted">{merchant.count}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingWidget(null)}
                className="px-4 py-2 text-sm text-theme-muted hover:text-theme"
              >
                Cancel
              </button>
              <button
                onClick={saveWidgetConfig}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
