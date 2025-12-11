'use client'

import { useTranslations } from 'next-intl'
import { TagWithUsage, TagTabConfig } from '@/types/admin'
import { TEST_IDS } from '@/test-ids'

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
  const t = useTranslations('admin.tags')
  const tCommon = useTranslations('common')

  // Resolve translation keys to actual labels
  const label = t(currentTagTab.labelKey as 'allTagsLabel')
  const description = t(currentTagTab.descriptionKey as 'allTagsDescription')

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted" data-testid={TEST_IDS.TAGS_TAB_DESCRIPTION}>{description}</p>
        {currentTagTab.namespace && (
          <button
            onClick={onAddTag}
            className="btn-primary"
            data-testid={TEST_IDS.TAGS_TAB_ADD_BUTTON}
          >
            {tCommon('add')} {label.replace(/s$/, '')}
          </button>
        )}
      </div>

      {tagsLoading ? (
        <div className="text-center py-12 text-theme-muted" data-testid={TEST_IDS.TAGS_TAB_LOADING}>{tCommon('loading')}</div>
      ) : tags.length === 0 ? (
        <div className="card p-12 text-center" data-testid={TEST_IDS.TAGS_TAB_EMPTY}>
          <p className="text-theme-muted mb-4">{t('noTags', { type: label.toLowerCase() })}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full divide-y divide-[var(--color-border)]" data-testid={TEST_IDS.TAGS_TAB_TABLE}>
            <thead className="table-header">
              <tr>
                {currentTagTab.showNamespace && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.namespace')}</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.value')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.description')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.usage')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-theme-muted uppercase">{t('tableHeaders.actions')}</th>
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
                      {tag.description || <span className="text-theme-muted italic">{t('notSet')}</span>}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-theme-muted">
                      {(tag.usage_count ?? 0) !== 1 ? t('usageCountPlural', { count: tag.usage_count ?? 0 }) : t('usageCount', { count: tag.usage_count ?? 0 })}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => onEditTag(tag)}
                      className="text-[var(--color-accent)] hover:opacity-80"
                    >
                      {tCommon('edit')}
                    </button>
                    <button
                      onClick={() => onDeleteTag(tag)}
                      className="text-negative hover:opacity-80 disabled:opacity-30"
                      disabled={(tag.usage_count ?? 0) > 0}
                      title={(tag.usage_count ?? 0) > 0 ? t('cannotDelete') : t('deleteTag')}
                    >
                      {tCommon('delete')}
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
