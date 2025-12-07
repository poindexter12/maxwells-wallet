'use client'

import { TagWithUsage, TagTabConfig } from '@/types/admin'

interface TagsTabProps {
  currentTagTab: TagTabConfig
  tags: TagWithUsage[]
  tagsLoading: boolean
  onAddTag: () => void
  onEditTag: (tag: TagWithUsage) => void
  onDeleteTag: (tag: TagWithUsage) => void
}

export function TagsTab({
  currentTagTab,
  tags,
  tagsLoading,
  onAddTag,
  onEditTag,
  onDeleteTag
}: TagsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">{currentTagTab.description}</p>
        {currentTagTab.namespace && (
          <button
            onClick={onAddTag}
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
                      onClick={() => onEditTag(tag)}
                      className="text-[var(--color-accent)] hover:opacity-80"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteTag(tag)}
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
  )
}
