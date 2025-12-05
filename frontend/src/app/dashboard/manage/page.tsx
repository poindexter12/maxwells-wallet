'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDashboard, Dashboard, DateRangeType } from '@/contexts/DashboardContext'

const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
  { value: 'mtd', label: 'Month to Date' },
  { value: 'qtd', label: 'Quarter to Date' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_year', label: 'Last Year' },
]

export default function ManageDashboards() {
  const {
    dashboards,
    loading,
    error,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    setDefaultDashboard,
    refreshDashboards,
  } = useDashboard()

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newDateRangeType, setNewDateRangeType] = useState<DateRangeType>('mtd')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const handleStartEdit = (dashboard: Dashboard) => {
    setEditingId(dashboard.id)
    setEditName(dashboard.name)
    setEditDescription(dashboard.description || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
  }

  const handleSaveEdit = async (dashboard: Dashboard) => {
    if (!editName.trim()) return

    await updateDashboard(dashboard.id, {
      name: editName.trim(),
      description: editDescription.trim() || null,
    })
    setEditingId(null)
    setEditName('')
    setEditDescription('')
  }

  const handleDateRangeChange = async (dashboardId: number, dateRangeType: DateRangeType) => {
    await updateDashboard(dashboardId, { date_range_type: dateRangeType })
  }

  const handleSetDefault = async (dashboardId: number) => {
    await setDefaultDashboard(dashboardId)
  }

  const handleDelete = async (dashboardId: number) => {
    await deleteDashboard(dashboardId)
    setDeleteConfirm(null)
  }

  const handleCreateDashboard = async () => {
    if (!newName.trim()) return

    await createDashboard({
      name: newName.trim(),
      description: newDescription.trim() || null,
      date_range_type: newDateRangeType,
    })

    setIsCreating(false)
    setNewName('')
    setNewDescription('')
    setNewDateRangeType('mtd')
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return

    const updates = [
      { id: dashboards[index].id, position: dashboards[index - 1].position },
      { id: dashboards[index - 1].id, position: dashboards[index].position },
    ]

    try {
      await fetch('/api/v1/dashboards/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      await refreshDashboards()
    } catch (err) {
      console.error('Failed to reorder dashboards:', err)
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index >= dashboards.length - 1) return

    const updates = [
      { id: dashboards[index].id, position: dashboards[index + 1].position },
      { id: dashboards[index + 1].id, position: dashboards[index].position },
    ]

    try {
      await fetch('/api/v1/dashboards/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      await refreshDashboards()
    } catch (err) {
      console.error('Failed to reorder dashboards:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-theme">Manage Dashboards</h1>
        </div>
        <div className="text-center py-12 text-theme-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-theme">Manage Dashboards</h1>
          <p className="text-sm text-theme-muted mt-1">
            Create, edit, and organize your dashboards
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme transition-colors"
          >
            Back to Dashboard
          </Link>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Create new dashboard form */}
      {isCreating && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-theme mb-4">Create New Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme mb-1">Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Dashboard name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme mb-1">Date Range</label>
              <select
                value={newDateRangeType}
                onChange={(e) => setNewDateRangeType(e.target.value as DateRangeType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-theme mb-1">Description (optional)</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setIsCreating(false)
                setNewName('')
                setNewDescription('')
                setNewDateRangeType('mtd')
              }}
              className="px-4 py-2 text-theme-muted hover:text-theme transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateDashboard}
              disabled={!newName.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Dashboard list */}
      <div className="space-y-4">
        {dashboards.map((dashboard, index) => (
          <div key={dashboard.id} className="card p-4">
            <div className="flex items-start gap-4">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1 text-theme-muted hover:text-theme disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index >= dashboards.length - 1}
                  className="p-1 text-theme-muted hover:text-theme disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Dashboard info */}
              <div className="flex-1 min-w-0">
                {editingId === dashboard.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEdit(dashboard)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-theme-muted hover:text-theme text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-theme">{dashboard.name}</h3>
                      {dashboard.is_default && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Default
                        </span>
                      )}
                    </div>
                    {dashboard.description && (
                      <p className="text-sm text-theme-muted mt-1">{dashboard.description}</p>
                    )}
                    <p className="text-sm text-theme-muted mt-1">
                      {dashboard.date_range.label}: {dashboard.date_range.start_date} to {dashboard.date_range.end_date}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {editingId !== dashboard.id && (
                <div className="flex items-center gap-2">
                  {/* Date range selector */}
                  <select
                    value={dashboard.date_range_type}
                    onChange={(e) => handleDateRangeChange(dashboard.id, e.target.value as DateRangeType)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DATE_RANGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {/* Edit button */}
                  <button
                    onClick={() => handleStartEdit(dashboard)}
                    className="p-2 text-theme-muted hover:text-theme transition-colors"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Set default button */}
                  {!dashboard.is_default && (
                    <button
                      onClick={() => handleSetDefault(dashboard.id)}
                      className="p-2 text-theme-muted hover:text-blue-500 transition-colors"
                      title="Set as default"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  )}

                  {/* Delete button */}
                  {deleteConfirm === dashboard.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(dashboard.id)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2 py-1 text-theme-muted hover:text-theme text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(dashboard.id)}
                      disabled={dashboards.length <= 1}
                      className="p-2 text-theme-muted hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={dashboards.length <= 1 ? "Can't delete the last dashboard" : 'Delete'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {dashboards.length === 0 && !isCreating && (
        <div className="text-center py-12 text-theme-muted">
          <p>No dashboards found. Create one to get started.</p>
        </div>
      )}
    </div>
  )
}
