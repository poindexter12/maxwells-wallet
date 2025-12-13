'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { TEST_IDS, CHAOS_EXCLUDED_IDS } from '@/test-ids'
import { BackupMetadata, SchedulerSettings } from '@/types/admin'
import { useDemoMode } from '@/contexts/DemoModeContext'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

export function BackupsTab() {
  const t = useTranslations('backup')
  const tCommon = useTranslations('common')
  const { isDemoMode } = useDemoMode()

  const intervalOptions = [
    { value: 1, label: t('schedule.intervals.hour') },
    { value: 24, label: t('schedule.intervals.day') },
    { value: 168, label: t('schedule.intervals.week') },
  ]

  const [backups, setBackups] = useState<BackupMetadata[]>([])
  const [schedule, setSchedule] = useState<SchedulerSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newDescription, setNewDescription] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  async function fetchBackups() {
    try {
      const res = await fetch('/api/v1/admin/backups')
      if (res.ok) {
        const data = await res.json()
        setBackups(data)
      }
    } catch (error) {
      console.error('Error fetching backups:', error)
    }
  }

  async function fetchSchedule() {
    try {
      const res = await fetch('/api/v1/settings/backup')
      if (res.ok) {
        const data = await res.json()
        setSchedule(data)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      await Promise.all([fetchBackups(), fetchSchedule()])
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleCreateBackup() {
    setActionInProgress(true)
    try {
      const res = await fetch('/api/v1/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newDescription || 'Manual backup',
          source: 'manual',
        }),
      })
      if (res.ok) {
        await fetchBackups()
        setShowCreateModal(false)
        setNewDescription('')
      } else {
        const error = await res.json()
        alert(`Error: ${error.message || 'Failed to create backup'}`)
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      alert('Failed to create backup')
    } finally {
      setActionInProgress(false)
    }
  }

  async function handleRestoreBackup(backupId: string) {
    if (confirmRestore !== backupId) {
      setConfirmRestore(backupId)
      return
    }

    setActionInProgress(true)
    try {
      const res = await fetch(`/api/v1/admin/restore/${backupId}?confirm=RESTORE`, {
        method: 'POST',
      })
      if (res.ok) {
        alert(t('backupRestored'))
        window.location.reload()
      } else {
        const error = await res.json()
        alert(`Error: ${error.message || 'Failed to restore backup'}`)
      }
    } catch (error) {
      console.error('Error restoring backup:', error)
      alert('Failed to restore backup')
    } finally {
      setActionInProgress(false)
      setConfirmRestore(null)
    }
  }

  async function handleDeleteBackup(backupId: string) {
    if (confirmDelete !== backupId) {
      setConfirmDelete(backupId)
      return
    }

    setActionInProgress(true)
    try {
      const res = await fetch(`/api/v1/admin/backup/${backupId}?confirm=DELETE`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchBackups()
      } else {
        const error = await res.json()
        alert(`Error: ${error.message || 'Failed to delete backup'}`)
      }
    } catch (error) {
      console.error('Error deleting backup:', error)
      alert('Failed to delete backup')
    } finally {
      setActionInProgress(false)
      setConfirmDelete(null)
    }
  }

  async function handleSetDemoBackup(backupId: string) {
    setActionInProgress(true)
    try {
      const res = await fetch(`/api/v1/admin/backup/${backupId}/set-demo`, {
        method: 'POST',
      })
      if (res.ok) {
        await fetchBackups()
      } else {
        const error = await res.json()
        alert(`Error: ${error.message || 'Failed to set demo backup'}`)
      }
    } catch (error) {
      console.error('Error setting demo backup:', error)
    } finally {
      setActionInProgress(false)
    }
  }

  async function handleUpdateSchedule(updates: Partial<SchedulerSettings>) {
    try {
      const res = await fetch('/api/v1/settings/backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        setSchedule(data)
      }
    } catch (error) {
      console.error('Error updating schedule:', error)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12" data-testid={TEST_IDS.BACKUP_LOADING}>
        {tCommon('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Schedule Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-theme mb-4">{t('schedule.title')}</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                data-testid={TEST_IDS.BACKUP_SCHEDULE_TOGGLE}
                checked={schedule?.auto_backup_enabled || false}
                onChange={(e) => handleUpdateSchedule({ auto_backup_enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-theme">{t('schedule.enabled')}</span>
            </label>
          </div>

          {schedule?.auto_backup_enabled && (
            <>
              <div className="flex items-center gap-4">
                <label className="text-sm text-theme-muted">{t('schedule.interval')}:</label>
                <select
                  data-testid={TEST_IDS.BACKUP_SCHEDULE_INTERVAL}
                  value={schedule?.auto_backup_interval_hours || 24}
                  onChange={(e) => handleUpdateSchedule({ auto_backup_interval_hours: parseInt(e.target.value) })}
                  className="px-3 py-1 border border-theme rounded bg-theme text-theme text-sm"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {schedule?.next_auto_backup && (
                  <span className="text-sm text-theme-muted">
                    {t('schedule.nextBackup')}: {formatDate(schedule.next_auto_backup)}
                  </span>
                )}
              </div>

              <div className="text-sm text-theme-muted pl-6">
                {t('schedule.retentionHelp')}
              </div>
            </>
          )}

          {isDemoMode && (
            <div className="flex items-center gap-4 pt-2 border-t border-theme">
              <label className="text-sm text-theme-muted">{t('schedule.demoResetInterval')}:</label>
              <select
                value={schedule?.demo_reset_interval_hours || 1}
                onChange={(e) => handleUpdateSchedule({ demo_reset_interval_hours: parseInt(e.target.value) })}
                className="px-3 py-1 border border-theme rounded bg-theme text-theme text-sm"
              >
                {intervalOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {schedule?.next_demo_reset && (
                <span className="text-sm text-theme-muted">
                  Next reset: {formatDate(schedule.next_demo_reset)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Backup List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme">{t('title')}</h2>
          <button
            data-testid={TEST_IDS.BACKUP_CREATE_BUTTON}
            onClick={() => setShowCreateModal(true)}
            disabled={actionInProgress}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded font-medium hover:opacity-90 disabled:opacity-50"
          >
            {t('createBackup')}
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-theme-muted" data-testid={TEST_IDS.BACKUP_EMPTY}>
            {t('noBackups')}
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid={TEST_IDS.BACKUP_LIST}>
            <table className="min-w-full divide-y divide-[var(--color-border)]">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-theme-muted uppercase">
                    {t('fields.description')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-theme-muted uppercase">
                    {t('fields.created')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-theme-muted uppercase">
                    {t('fields.size')}
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-theme-muted uppercase">
                    {t('fields.source')}
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-theme-muted uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-theme">{backup.description}</span>
                        {backup.is_demo_backup && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">
                            {t('fields.demoBackup')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-theme-muted">
                      {formatDate(backup.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-theme-muted">
                      {formatBytes(backup.size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-sm text-theme-muted capitalize">
                      {backup.source.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          data-testid={CHAOS_EXCLUDED_IDS.BACKUP_RESTORE}
                          onClick={() => handleRestoreBackup(backup.id)}
                          disabled={actionInProgress}
                          className={`px-3 py-1 text-xs rounded font-medium ${
                            confirmRestore === backup.id
                              ? 'bg-amber-500 text-white'
                              : 'bg-theme-elevated text-theme hover:bg-theme-hover border border-theme'
                          } disabled:opacity-50`}
                        >
                          {confirmRestore === backup.id ? tCommon('confirm') : t('restoreBackup')}
                        </button>
                        {confirmRestore === backup.id && (
                          <button
                            onClick={() => setConfirmRestore(null)}
                            className="px-3 py-1 text-xs bg-theme-elevated text-theme rounded hover:bg-theme-hover border border-theme"
                          >
                            {tCommon('cancel')}
                          </button>
                        )}
                        {!backup.is_demo_backup && (
                          <>
                            <button
                              onClick={() => handleSetDemoBackup(backup.id)}
                              disabled={actionInProgress}
                              className="px-3 py-1 text-xs bg-theme-elevated text-theme rounded hover:bg-theme-hover border border-theme disabled:opacity-50"
                            >
                              Set Demo
                            </button>
                            <button
                              data-testid={CHAOS_EXCLUDED_IDS.BACKUP_DELETE}
                              onClick={() => handleDeleteBackup(backup.id)}
                              disabled={actionInProgress}
                              className={`px-3 py-1 text-xs rounded font-medium ${
                                confirmDelete === backup.id
                                  ? 'bg-[var(--color-negative)] text-white'
                                  : 'text-[var(--color-negative)] hover:bg-negative border border-[var(--color-negative)]'
                              } disabled:opacity-50`}
                            >
                              {confirmDelete === backup.id ? tCommon('confirm') : t('deleteBackup')}
                            </button>
                            {confirmDelete === backup.id && (
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-3 py-1 text-xs bg-theme-elevated text-theme rounded hover:bg-theme-hover border border-theme"
                              >
                                {tCommon('cancel')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-theme-elevated rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-theme mb-4">{t('createBackup')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  {t('fields.description')}
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Manual backup"
                  className="w-full px-3 py-2 border border-theme rounded bg-theme text-theme"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewDescription('')
                  }}
                  className="px-4 py-2 bg-theme-elevated text-theme rounded hover:bg-theme-hover border border-theme"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleCreateBackup}
                  disabled={actionInProgress}
                  className="px-4 py-2 bg-[var(--color-accent)] text-white rounded font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionInProgress ? tCommon('loading') : tCommon('create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
