'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'BofA Bank',
  'bofa_cc': 'BofA CC',
  'amex_cc': 'Amex CC',
  'inspira_hsa': 'Inspira HSA',
  'venmo': 'Venmo',
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

type AdminTab = 'overview' | 'imports' | 'all-tags' | 'buckets' | 'accounts' | 'occasions' | 'expense-types'

const TAG_TABS: { id: AdminTab; namespace: string | null; label: string; description: string; showNamespace: boolean }[] = [
  { id: 'all-tags', namespace: null, label: 'All Tags', description: 'View all tags across all namespaces', showNamespace: true },
  { id: 'buckets', namespace: 'bucket', label: 'Buckets', description: 'Spending categories like groceries, dining, entertainment', showNamespace: false },
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
        alert(`Purged ${result.deleted_transactions} transactions and ${result.deleted_sessions} import sessions`)
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
    if (!editingTag || !currentTagTab || !editingTag.value.trim()) return

    setSaving(true)
    setTagError(null)

    try {
      const res = await fetch(`/api/v1/tags/${editingTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: editingTag.value.trim(),
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
      <PageHelp
        pageId="admin"
        title="Admin Help"
        description="Manage your data, import history, and tag configuration. Use the tabs to navigate between different admin sections."
        steps={[
          "Overview: See database stats and account summaries",
          "Imports: View import history and roll back imports if needed",
          "Tags: Manage buckets, accounts, occasions, and expense types"
        ]}
        tips={[
          "Rolling back an import deletes all transactions from that import",
          "Tags are organized by namespace (bucket, account, occasion, expense)",
          "You can edit tag descriptions to give them friendly display names"
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold text-theme">Admin</h1>
        <p className="mt-2 text-sm text-theme-muted">
          Database management, imports, and tag configuration
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('imports')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'imports'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
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
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
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
              <div className="card p-4">
                <p className="text-sm text-theme-muted">Total Transactions</p>
                <p className="text-2xl font-bold text-theme">{stats.total_transactions.toLocaleString()}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-theme-muted">Import Sessions</p>
                <p className="text-2xl font-bold text-theme">{stats.total_import_sessions}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-theme-muted">Completed Imports</p>
                <p className="text-2xl font-bold text-positive">
                  {stats.import_session_status.completed || 0}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-theme-muted">Rolled Back</p>
                <p className="text-2xl font-bold text-negative">
                  {stats.import_session_status.rolled_back || 0}
                </p>
              </div>
            </div>
          )}

          {/* Account Stats */}
          {stats && stats.account_stats.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-theme mb-4">Transactions by Account</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--color-border)]">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-theme-muted uppercase">Account</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-theme-muted uppercase">Count</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-theme-muted uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {stats.account_stats.map((stat, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm text-theme">{stat.account}</td>
                        <td className="px-4 py-2 text-sm text-right text-theme">{stat.count.toLocaleString()}</td>
                        <td className={`px-4 py-2 text-sm text-right font-medium ${stat.total >= 0 ? 'text-positive' : 'text-negative'}`}>
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
          <div className="bg-negative border border-[var(--color-negative)] rounded-lg p-6">
            <h2 className="text-lg font-semibold text-negative mb-4">Danger Zone</h2>
            <p className="text-sm text-negative mb-4">
              These actions are destructive and cannot be undone. Use with extreme caution.
            </p>
            <button
              onClick={handlePurgeAll}
              disabled={actionInProgress}
              className={`px-4 py-2 rounded font-medium ${
                confirmPurgeAll
                  ? 'bg-[var(--color-negative)] text-white hover:opacity-90'
                  : 'bg-negative text-negative hover:opacity-80'
              } disabled:opacity-50`}
            >
              {actionInProgress ? 'Processing...' : confirmPurgeAll ? 'Click again to confirm PURGE ALL' : 'Purge All Transactions'}
            </button>
            {confirmPurgeAll && (
              <button
                onClick={() => setConfirmPurgeAll(false)}
                className="ml-2 px-4 py-2 bg-theme-elevated text-theme rounded hover:opacity-80 border border-theme"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Imports Tab */}
      {activeTab === 'imports' && (
        <div className="card">
          <div className="px-6 py-4 border-b border-theme flex justify-between items-start">
            <div>
              <h2 className="text-lg font-semibold text-theme">Import Sessions</h2>
              <p className="text-sm text-theme-muted">
                History of all CSV imports. You can roll back individual imports by deleting their sessions.
              </p>
            </div>
            <Link
              href="/import"
              className="btn-primary"
            >
              Import New
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border)]">
              <thead className="table-header">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">Imported</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">Duplicates</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">Date Range</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-theme-muted">
                      No import sessions found
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id} className={session.status === 'rolled_back' ? 'bg-negative' : ''}>
                      <td className="px-4 py-3 text-sm text-theme">
                        {format(new Date(session.created_at), 'MMM d, yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-xs text-theme">{session.filename}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded text-xs">
                          {FORMAT_NAMES[session.format_type] || session.format_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-theme">{session.account_source || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-theme">
                        {session.transaction_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-theme-muted">
                        {session.duplicate_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-theme-muted">
                        {session.date_range_start && session.date_range_end
                          ? `${format(new Date(session.date_range_start), 'MMM d')} - ${format(new Date(session.date_range_end), 'MMM d, yyyy')}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          session.status === 'completed' ? 'bg-positive text-positive' :
                          session.status === 'rolled_back' ? 'bg-negative text-negative' :
                          'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
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
                                  ? 'bg-[var(--color-negative)] text-white'
                                  : 'bg-negative text-negative hover:opacity-80'
                              } disabled:opacity-50`}
                            >
                              {confirmDelete === session.id ? 'Confirm Delete' : 'Roll Back'}
                            </button>
                            {confirmDelete === session.id && (
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="ml-1 px-2 py-1 bg-theme-elevated text-theme rounded text-xs hover:opacity-80 border border-theme"
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
            <p className="text-sm text-theme-muted">{currentTagTab.description}</p>
            {currentTagTab.namespace && (
              <button
                onClick={() => {
                  setNewTag({ namespace: currentTagTab.namespace || '', value: '', description: '' })
                  setTagError(null)
                  setShowCreateModal(true)
                }}
                className="btn-primary"
              >
                Add {currentTagTab.label.replace(/s$/, '')}
              </button>
            )}
          </div>

          {tagsLoading ? (
            <div className="text-center py-12 text-theme-muted">Loading...</div>
          ) : tags.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-theme-muted mb-4">No {currentTagTab.label.toLowerCase()} configured yet.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="min-w-full divide-y divide-[var(--color-border)]">
                <thead className="table-header">
                  <tr>
                    {currentTagTab.showNamespace && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">Namespace</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">Value (ID)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">Description / Display Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">Usage</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-theme-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {tags.map((tag) => (
                    <tr key={tag.id}>
                      {currentTagTab.showNamespace && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
                            {tag.namespace}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-theme">
                          {tag.value}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-theme">
                          {tag.description || <span className="text-theme-muted italic">Not set</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-muted">
                          {tag.usage_count ?? 0} transaction{(tag.usage_count ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setEditingTag(tag)
                            setTagError(null)
                          }}
                          className="text-[var(--color-accent)] hover:opacity-80"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag)}
                          className="text-negative hover:opacity-80 disabled:opacity-30"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-theme mb-4">
              Add {currentTagTab.label.replace(/s$/, '')}
            </h2>

            {tagError && (
              <div className="mb-4 p-3 bg-negative text-negative rounded-md text-sm">
                {tagError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  Value
                </label>
                <input
                  type="text"
                  value={newTag.value}
                  onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
                  placeholder={currentTagTab.namespace === 'account' ? 'e.g., chase-checking' : 'e.g., vacation'}
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-theme-muted">
                  Will be normalized to: {newTag.value.trim().toLowerCase().replace(/\s+/g, '-') || '...'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  {currentTagTab.namespace === 'account' ? 'Display Name' : 'Description'} (optional)
                </label>
                <input
                  type="text"
                  value={newTag.description}
                  onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  placeholder={currentTagTab.namespace === 'account' ? 'e.g., Chase Checking Account' : 'Brief description'}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-theme hover:bg-[var(--color-bg-hover)] rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={saving || !newTag.value.trim()}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-theme mb-4">
              Edit Tag
            </h2>

            {tagError && (
              <div className="mb-4 p-3 bg-negative text-negative rounded-md text-sm">
                {tagError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  Namespace
                </label>
                <input
                  type="text"
                  value={editingTag.namespace}
                  disabled
                  className="input w-full bg-[var(--color-bg-hover)] text-theme-muted font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  Value (ID)
                </label>
                <input
                  type="text"
                  value={editingTag.value}
                  onChange={(e) => setEditingTag({ ...editingTag, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="input w-full font-mono"
                  placeholder="e.g., groceries, vacation"
                />
                <p className="mt-1 text-xs text-theme-muted">Unique identifier within the namespace</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  {editingTag.namespace === 'account' ? 'Display Name' : 'Description'}
                </label>
                <input
                  type="text"
                  value={editingTag.description || ''}
                  onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                  placeholder={editingTag.namespace === 'account' ? 'Display name for this account' : 'Brief description'}
                  className="input w-full"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingTag(null)}
                className="px-4 py-2 text-theme hover:bg-[var(--color-bg-hover)] rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTag}
                disabled={saving || !editingTag.value.trim()}
                className="btn-primary disabled:opacity-50"
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
