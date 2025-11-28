'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'

const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'BofA Bank',
  'bofa_cc': 'BofA CC',
  'amex_cc': 'Amex CC',
  'unknown': 'Unknown'
}

interface ImportSession {
  id: number
  filename: string
  format_type: string
  account_source: string | null
  transaction_count: number
  duplicate_count: number
  total_amount: number
  date_range_start: string | null
  date_range_end: string | null
  status: string
  created_at: string
}

interface AdminStats {
  total_transactions: number
  account_stats: Array<{ account: string; count: number; total: number }>
  total_import_sessions: number
  import_session_status: Record<string, number>
}

interface Tag {
  id: number
  namespace: string
  value: string
  description: string | null
  created_at: string
  updated_at: string
}

interface TagWithUsage extends Tag {
  usage_count?: number
}

type AdminTab = 'overview' | 'imports' | 'all-tags' | 'accounts' | 'occasions' | 'expense-types'

const TAG_TABS: { id: AdminTab; namespace: string | null; label: string; description: string; showNamespace: boolean }[] = [
  { id: 'all-tags', namespace: null, label: 'All Tags', description: 'View all tags across all namespaces', showNamespace: true },
  { id: 'accounts', namespace: 'account', label: 'Accounts', description: 'Bank accounts and credit cards with display names', showNamespace: false },
  { id: 'occasions', namespace: 'occasion', label: 'Occasions', description: 'Special events like vacation, holidays, birthdays', showNamespace: false },
  { id: 'expense-types', namespace: 'expense', label: 'Expense Types', description: 'Recurring, one-time, refund classifications', showNamespace: false },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [sessions, setSessions] = useState<ImportSession[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)

  // Tag management state
  const [tags, setTags] = useState<TagWithUsage[]>([])
  const [tagsLoading, setTagsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [newTag, setNewTag] = useState({ namespace: '', value: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [tagError, setTagError] = useState<string | null>(null)

  const currentTagTab = TAG_TABS.find(t => t.id === activeTab)

  const fetchData = async () => {
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        fetch('/api/v1/admin/import-sessions'),
        fetch('/api/v1/admin/stats')
      ])
      const sessionsData = await sessionsRes.json()
      const statsData = await statsRes.json()
      setSessions(sessionsData)
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTags(namespace: string | null) {
    setTagsLoading(true)
    try {
      const url = namespace ? `/api/v1/tags?namespace=${namespace}` : '/api/v1/tags'
      const res = await fetch(url)
      const data = await res.json()

      const tagsWithUsage = await Promise.all(
        data.map(async (tag: Tag) => {
          try {
            const usageRes = await fetch(`/api/v1/tags/${tag.id}/usage-count`)
            const usageData = await usageRes.json()
            return { ...tag, usage_count: usageData.usage_count }
          } catch {
            return { ...tag, usage_count: 0 }
          }
        })
      )

      setTags(tagsWithUsage)
    } catch (err) {
      console.error('Error fetching tags:', err)
    } finally {
      setTagsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (currentTagTab) {
      fetchTags(currentTagTab.namespace)
    }
  }, [activeTab])

  const handleDeleteSession = async (sessionId: number) => {
    if (confirmDelete !== sessionId) {
      setConfirmDelete(sessionId)
      return
    }

    setActionInProgress(true)
    try {
      const res = await fetch(`/api/v1/admin/import-sessions/${sessionId}?confirm=DELETE`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchData()
      } else {
        const error = await res.json()
        alert(`Error: ${error.detail}`)
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete session')
    } finally {
      setActionInProgress(false)
      setConfirmDelete(null)
    }
  }

  const handlePurgeAll = async () => {
    if (!confirmPurgeAll) {
      setConfirmPurgeAll(true)
      return
    }

    setActionInProgress(true)
    try {
      const res = await fetch('/api/v1/admin/transactions/purge-all?confirm=PURGE_ALL', {
        method: 'DELETE'
      })
      if (res.ok) {
        const result = await res.json()
        alert(`Purged ${result.deleted_transactions} transactions`)
        await fetchData()
      } else {
        const error = await res.json()
        alert(`Error: ${error.detail}`)
      }
    } catch (error) {
      console.error('Error purging transactions:', error)
      alert('Failed to purge transactions')
    } finally {
      setActionInProgress(false)
      setConfirmPurgeAll(false)
    }
  }

  async function handleCreateTag() {
    if (!newTag.value.trim() || !currentTagTab) return

    setSaving(true)
    setTagError(null)

    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: currentTagTab.namespace,
          value: newTag.value.trim().toLowerCase().replace(/\s+/g, '-'),
          description: newTag.description.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to create tag')
      }

      setShowCreateModal(false)
      setNewTag({ namespace: '', value: '', description: '' })
      fetchTags(currentTagTab.namespace)
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateTag() {
    if (!editingTag || !currentTagTab) return

    setSaving(true)
    setTagError(null)

    try {
      const res = await fetch(`/api/v1/tags/${editingTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editingTag.description?.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to update tag')
      }

      setEditingTag(null)
      fetchTags(currentTagTab.namespace)
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to update tag')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTag(tag: Tag) {
    if (!confirm(`Delete "${tag.namespace}:${tag.value}"? This cannot be undone.`)) return
    if (!currentTagTab) return

    try {
      const res = await fetch(`/api/v1/tags/${tag.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to delete tag')
      }

      fetchTags(currentTagTab.namespace)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete tag')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <p className="mt-2 text-sm text-gray-600">
          Database management, imports, and tag configuration
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('imports')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'imports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Imports
          </button>
          {TAG_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold">{stats.total_transactions.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Import Sessions</p>
                <p className="text-2xl font-bold">{stats.total_import_sessions}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Completed Imports</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.import_session_status.completed || 0}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Rolled Back</p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.import_session_status.rolled_back || 0}
                </p>
              </div>
            </div>
          )}

          {/* Account Stats */}
          {stats && stats.account_stats.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Transactions by Account</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.account_stats.map((stat, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{stat.account}</td>
                        <td className="px-4 py-2 text-sm text-right">{stat.count.toLocaleString()}</td>
                        <td className={`px-4 py-2 text-sm text-right font-medium ${stat.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(stat.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-4">Danger Zone</h2>
            <p className="text-sm text-red-700 mb-4">
              These actions are destructive and cannot be undone. Use with extreme caution.
            </p>
            <button
              onClick={handlePurgeAll}
              disabled={actionInProgress}
              className={`px-4 py-2 rounded font-medium ${
                confirmPurgeAll
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              } disabled:opacity-50`}
            >
              {actionInProgress ? 'Processing...' : confirmPurgeAll ? 'Click again to confirm PURGE ALL' : 'Purge All Transactions'}
            </button>
            {confirmPurgeAll && (
              <button
                onClick={() => setConfirmPurgeAll(false)}
                className="ml-2 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Imports Tab */}
      {activeTab === 'imports' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Import Sessions</h2>
            <p className="text-sm text-gray-600">
              History of all CSV imports. You can roll back individual imports by deleting their sessions.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Imported</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duplicates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Range</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No import sessions found
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id} className={session.status === 'rolled_back' ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-sm">
                        {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-xs">{session.filename}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {FORMAT_NAMES[session.format_type] || session.format_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{session.account_source || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {session.transaction_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {session.duplicate_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {session.date_range_start && session.date_range_end
                          ? `${format(new Date(session.date_range_start), 'MMM d')} - ${format(new Date(session.date_range_end), 'MMM d, yyyy')}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          session.status === 'completed' ? 'bg-green-100 text-green-800' :
                          session.status === 'rolled_back' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {session.status === 'completed' && (
                          <>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              disabled={actionInProgress}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                confirmDelete === session.id
                                  ? 'bg-red-600 text-white'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              } disabled:opacity-50`}
                            >
                              {confirmDelete === session.id ? 'Confirm Delete' : 'Roll Back'}
                            </button>
                            {confirmDelete === session.id && (
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="ml-1 px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tag Management Tabs (All Tags, Accounts, Occasions, Expense Types) */}
      {currentTagTab && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">{currentTagTab.description}</p>
            {currentTagTab.namespace && (
              <button
                onClick={() => {
                  setNewTag({ namespace: currentTagTab.namespace || '', value: '', description: '' })
                  setTagError(null)
                  setShowCreateModal(true)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add {currentTagTab.label.replace(/s$/, '')}
              </button>
            )}
          </div>

          {tagsLoading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : tags.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 mb-4">No {currentTagTab.label.toLowerCase()} configured yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {currentTagTab.showNamespace ? 'Tag' : 'Value'}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description / Display Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tags.map((tag) => (
                    <tr key={tag.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                          {currentTagTab.showNamespace ? `${tag.namespace}:${tag.value}` : tag.value}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {tag.description || <span className="text-gray-400 italic">Not set</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {tag.usage_count ?? 0} transaction{(tag.usage_count ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setEditingTag(tag)
                            setTagError(null)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="text-red-600 hover:text-red-800 disabled:text-gray-300"
                          disabled={(tag.usage_count ?? 0) > 0}
                          title={(tag.usage_count ?? 0) > 0 ? 'Cannot delete: tag is in use' : 'Delete tag'}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateModal && currentTagTab && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Add {currentTagTab.label.replace(/s$/, '')}
            </h2>

            {tagError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {tagError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={newTag.value}
                  onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
                  placeholder={currentTagTab.namespace === 'account' ? 'e.g., chase-checking' : 'e.g., vacation'}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Will be normalized to: {newTag.value.trim().toLowerCase().replace(/\s+/g, '-') || '...'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {currentTagTab.namespace === 'account' ? 'Display Name' : 'Description'} (optional)
                </label>
                <input
                  type="text"
                  value={newTag.description}
                  onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  placeholder={currentTagTab.namespace === 'account' ? 'e.g., Chase Checking Account' : 'Brief description'}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={saving || !newTag.value.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Edit: {editingTag.value}
            </h2>

            {tagError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {tagError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={editingTag.value}
                  disabled
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingTag.namespace === 'account' ? 'Display Name' : 'Description'}
                </label>
                <input
                  type="text"
                  value={editingTag.description || ''}
                  onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                  placeholder={editingTag.namespace === 'account' ? 'Display name for this account' : 'Brief description'}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingTag(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTag}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
