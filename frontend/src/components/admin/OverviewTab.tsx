'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format'
import { TEST_IDS, CHAOS_EXCLUDED_IDS } from '@/test-ids'
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
  const t = useTranslations('admin.overview')
  const tCommon = useTranslations('common')

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid={TEST_IDS.OVERVIEW_STATS}>
          <div className="card p-4" data-testid={TEST_IDS.OVERVIEW_STAT_TOTAL_TRANSACTIONS}>
            <p className="text-sm text-theme-muted">{t('stats.totalTransactions')}</p>
            <p className="text-2xl font-bold text-theme" data-testid={TEST_IDS.OVERVIEW_STAT_TOTAL_TRANSACTIONS_VALUE}>{stats.total_transactions.toLocaleString()}</p>
          </div>
          <div className="card p-4" data-testid={TEST_IDS.OVERVIEW_STAT_IMPORT_SESSIONS}>
            <p className="text-sm text-theme-muted">{t('stats.importSessions')}</p>
            <p className="text-2xl font-bold text-theme" data-testid={TEST_IDS.OVERVIEW_STAT_IMPORT_SESSIONS_VALUE}>{stats.total_import_sessions}</p>
          </div>
          <div className="card p-4" data-testid={TEST_IDS.OVERVIEW_STAT_COMPLETED_IMPORTS}>
            <p className="text-sm text-theme-muted">{t('stats.completedImports')}</p>
            <p className="text-2xl font-bold text-positive" data-testid={TEST_IDS.OVERVIEW_STAT_COMPLETED_IMPORTS_VALUE}>
              {stats.import_session_status.completed || 0}
            </p>
          </div>
          <div className="card p-4" data-testid={TEST_IDS.OVERVIEW_STAT_ROLLED_BACK}>
            <p className="text-sm text-theme-muted">{t('stats.rolledBack')}</p>
            <p className="text-2xl font-bold text-negative" data-testid={TEST_IDS.OVERVIEW_STAT_ROLLED_BACK_VALUE}>
              {stats.import_session_status.rolled_back || 0}
            </p>
          </div>
        </div>
      )}

      {/* Account Stats */}
      {stats && stats.account_stats.length > 0 && (
        <div className="card p-6" data-testid={TEST_IDS.OVERVIEW_ACCOUNT_STATS}>
          <h2 className="text-lg font-semibold text-theme mb-4">{t('transactionsByAccount')}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border)]">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.account')}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.count')}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.total')}</th>
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
      <div className="bg-negative border border-[var(--color-negative)] rounded-lg p-6" data-testid={TEST_IDS.OVERVIEW_DANGER_ZONE}>
        <h2 className="text-lg font-semibold text-negative mb-4">{t('dangerZone')}</h2>
        <p className="text-sm text-negative mb-4">
          {t('dangerZoneWarning')}
        </p>
        <button
          data-testid={CHAOS_EXCLUDED_IDS.PURGE_ALL_DATA}
          onClick={onPurgeAll}
          disabled={actionInProgress}
          className={`px-4 py-2 rounded font-medium ${
            confirmPurgeAll
              ? 'bg-[var(--color-negative)] text-white hover:opacity-90'
              : 'bg-negative text-negative hover:opacity-80'
          } disabled:opacity-50`}
        >
          {actionInProgress ? t('processing') : confirmPurgeAll ? t('purgeAllConfirm') : t('purgeAll')}
        </button>
        {confirmPurgeAll && (
          <button
            onClick={onCancelPurge}
            className="ml-2 px-4 py-2 bg-theme-elevated text-theme rounded hover:opacity-80 border border-theme"
          >
            {tCommon('cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
