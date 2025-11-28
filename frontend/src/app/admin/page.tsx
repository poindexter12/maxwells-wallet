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

export default function AdminPage() {
  const [sessions, setSessions] = useState<ImportSession[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)

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

  useEffect(() => {
    fetchData()
  }, [])

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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <p className="mt-2 text-sm text-gray-600">
          Database management and import session history
        </p>
      </div>

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
        <h2 className="text-lg font-semibold text-red-800 mb-4">⚠️ Danger Zone</h2>
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

      {/* Import Sessions */}
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
    </div>
  )
}
