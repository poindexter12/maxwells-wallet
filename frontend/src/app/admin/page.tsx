'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TEST_IDS } from '@/test-ids'
import { PageHelp } from '@/components/PageHelp'
import { OverviewTab } from '@/components/admin/OverviewTab'
import { ImportsTab } from '@/components/admin/ImportsTab'
import { HealthTab } from '@/components/admin/HealthTab'
import { TagsTab } from '@/components/admin/TagsTab'
import { CreateTagModal, EditTagModal } from '@/components/admin/TagModal'
import {
  ImportSession,
  AdminStats,
  Tag,
  TagWithUsage,
  AdminTab,
  TAG_TABS
} from '@/types/admin'

export default function AdminPage() {
  const t = useTranslations('admin')
  const tCommon = useTranslations('common')
  const tTags = useTranslations('admin.tags')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]) // currentTagTab is derived from activeTab

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
      const res = await fetch('/api/v1/admin/purge-all?confirm=PURGE_ALL', {
        method: 'DELETE'
      })
      if (res.ok) {
        const result = await res.json()

        // Clear browser storage if requested by backend
        if (result.clear_browser_storage) {
          localStorage.clear()
          sessionStorage.clear()
        }

        const counts = result.counts || {}
        alert(`Application reset complete!\n\nPurged:\n` +
          `- ${counts.transactions || 0} transactions\n` +
          `- ${counts.import_sessions || 0} import sessions\n` +
          `- ${counts.budgets || 0} budgets\n` +
          `- ${counts.tags_deleted || 0} tags\n` +
          `- ${counts.dashboards_deleted || 0} dashboards\n` +
          `- ${counts.saved_filters || 0} saved filters`)

        // Reload the page to reset all state
        window.location.reload()
      } else {
        const error = await res.json()
        alert(`Error: ${error.detail?.message || error.detail}`)
      }
    } catch (error) {
      console.error('Error purging data:', error)
      alert('Failed to purge data')
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
    if (!confirm(tTags('deleteConfirm', { namespace: tag.namespace, value: tag.value }))) return
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
    return <div className="text-center py-12">{tCommon('loading')}</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp pageId="admin" />

      <div>
        <h1 className="text-3xl font-bold text-theme">{t('title')}</h1>
        <p className="mt-2 text-sm text-theme-muted">
          {t('subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="-mb-px flex space-x-8">
          <button
            data-testid={TEST_IDS.ADMIN_TAB_OVERVIEW}
            data-chaos-target="admin-tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overview'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
            }`}
          >
            {t('tabs.overview')}
          </button>
          <button
            data-testid={TEST_IDS.ADMIN_TAB_IMPORTS}
            data-chaos-target="admin-tab-imports"
            onClick={() => setActiveTab('imports')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'imports'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
            }`}
          >
            {t('tabs.imports')}
          </button>
          <button
            data-chaos-target="admin-tab-health"
            onClick={() => setActiveTab('health')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'health'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
            }`}
          >
            {t('tabs.health')}
          </button>
          {TAG_TABS.map((tab) => (
            <button
              key={tab.id}
              data-chaos-target={`admin-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
              }`}
            >
              {t(`tabs.${tab.id === 'all-tags' ? 'allTags' : tab.id === 'expense-types' ? 'expenses' : tab.id}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          confirmPurgeAll={confirmPurgeAll}
          actionInProgress={actionInProgress}
          onPurgeAll={handlePurgeAll}
          onCancelPurge={() => setConfirmPurgeAll(false)}
        />
      )}

      {activeTab === 'imports' && (
        <ImportsTab
          sessions={sessions}
          confirmDelete={confirmDelete}
          actionInProgress={actionInProgress}
          onDeleteSession={handleDeleteSession}
          onCancelDelete={() => setConfirmDelete(null)}
        />
      )}

      {activeTab === 'health' && <HealthTab />}

      {currentTagTab && (
        <TagsTab
          currentTagTab={currentTagTab}
          tags={tags}
          tagsLoading={tagsLoading}
          onAddTag={() => {
            setNewTag({ namespace: currentTagTab.namespace || '', value: '', description: '' })
            setTagError(null)
            setShowCreateModal(true)
          }}
          onEditTag={(tag) => {
            setEditingTag(tag)
            setTagError(null)
          }}
          onDeleteTag={handleDeleteTag}
        />
      )}

      {/* Modals */}
      {showCreateModal && currentTagTab && (
        <CreateTagModal
          currentTagTab={currentTagTab}
          newTag={newTag}
          setNewTag={setNewTag}
          saving={saving}
          tagError={tagError}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTag}
        />
      )}

      {editingTag && (
        <EditTagModal
          editingTag={editingTag}
          setEditingTag={setEditingTag}
          saving={saving}
          tagError={tagError}
          onClose={() => setEditingTag(null)}
          onSave={handleUpdateTag}
        />
      )}
    </div>
  )
}
