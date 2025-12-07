'use client'

import { formatCurrency } from '@/lib/format'
import { AdminStats } from '@/types/admin'

interface OverviewTabProps {
  stats: AdminStats | null
  confirmPurgeAll: boolean
  actionInProgress: boolean
  onPurgeAll: () => void
  onCancelPurge: () => void
}

export function OverviewTab({
  stats,
  confirmPurgeAll,
  actionInProgress,
  onPurgeAll,
  onCancelPurge
}: OverviewTabProps) {
  return (
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
          onClick={onPurgeAll}
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
            onClick={onCancelPurge}
            className="ml-2 px-4 py-2 bg-theme-elevated text-theme rounded hover:opacity-80 border border-theme"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
