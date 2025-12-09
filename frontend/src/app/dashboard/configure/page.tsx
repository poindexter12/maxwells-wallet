'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHelp } from '@/components/PageHelp'
import { WidgetRow } from '@/components/dashboard/WidgetRow'
import { WidgetEditModal } from '@/components/dashboard/WidgetEditModal'
import { WidgetReference } from '@/components/dashboard/WidgetReference'
import {
  Widget,
  Bucket,
  FilterOption,
  WidgetConfig,
  parseWidgetConfig
} from '@/types/dashboard'

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
              and filter it to show only &quot;Groceries&quot; spending.
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
          {sortedWidgets.map((widget, index) => (
            <WidgetRow
              key={widget.id}
              widget={widget}
              index={index}
              isFirst={index === 0}
              isLast={index === sortedWidgets.length - 1}
              config={parseWidgetConfig(widget.config)}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onToggleVisibility={handleToggleVisibility}
              onEdit={openEditModal}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* Widget Type Reference */}
      <WidgetReference />

      {/* Edit Widget Modal */}
      {editingWidget && (
        <WidgetEditModal
          widget={editingWidget}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editBuckets={editBuckets}
          setEditBuckets={setEditBuckets}
          editAccounts={editAccounts}
          setEditAccounts={setEditAccounts}
          editMerchants={editMerchants}
          setEditMerchants={setEditMerchants}
          availableBuckets={availableBuckets}
          availableAccounts={availableAccounts}
          availableMerchants={availableMerchants}
          saving={saving}
          onClose={() => setEditingWidget(null)}
          onSave={saveWidgetConfig}
        />
      )}
    </div>
  )
}
