'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useFormat } from '@/hooks/useFormat'
import { CHAOS_EXCLUDED_IDS } from '@/test-ids'
import { ImportSession, FORMAT_NAMES } from '@/types/admin'

interface ImportsTabProps {
  sessions: ImportSession[]
  confirmDelete: number | null
  actionInProgress: boolean
  onDeleteSession: (sessionId: number) => void
  onCancelDelete: () => void
}

export function ImportsTab({
  sessions,
  confirmDelete,
  actionInProgress,
  onDeleteSession,
  onCancelDelete
}: ImportsTabProps) {
  const t = useTranslations('admin.imports')
  const tCommon = useTranslations('common')
  const { formatDateTime, formatDateRange } = useFormat()

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-theme flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-theme">{t('title')}</h2>
          <p className="text-sm text-theme-muted">
            {t('subtitle')}
          </p>
        </div>
        <Link
          href="/import"
          className="btn-primary"
        >
          {t('importNew')}
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border)]">
          <thead className="table-header">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.date')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.file')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.format')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.account')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.imported')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.duplicates')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.dateRange')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.status')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-theme-muted">
                  {t('noSessions')}
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className={session.status === 'rolled_back' ? 'bg-negative' : ''}>
                  <td className="px-4 py-3 text-sm text-theme">
                    {formatDateTime(session.created_at)}
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
                      ? formatDateRange(session.date_range_start, session.date_range_end)
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
                          data-testid={CHAOS_EXCLUDED_IDS.ROLLBACK_IMPORT}
                          onClick={() => onDeleteSession(session.id)}
                          disabled={actionInProgress}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            confirmDelete === session.id
                              ? 'bg-[var(--color-negative)] text-white'
                              : 'bg-negative text-negative hover:opacity-80'
                          } disabled:opacity-50`}
                        >
                          {confirmDelete === session.id ? t('confirmDelete') : t('rollBack')}
                        </button>
                        {confirmDelete === session.id && (
                          <button
                            onClick={onCancelDelete}
                            className="ml-1 px-2 py-1 bg-theme-elevated text-theme rounded text-xs hover:opacity-80 border border-theme"
                          >
                            {tCommon('cancel')}
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
  )
}
