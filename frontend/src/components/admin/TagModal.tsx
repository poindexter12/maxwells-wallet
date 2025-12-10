'use client'

import { useTranslations } from 'next-intl'
import { Tag, TagTabConfig } from '@/types/admin'

interface CreateTagModalProps {
  currentTagTab: TagTabConfig
  newTag: { namespace: string; value: string; description: string }
  setNewTag: (tag: { namespace: string; value: string; description: string }) => void
  saving: boolean
  tagError: string | null
  onClose: () => void
  onCreate: () => void
}

export function CreateTagModal({
  currentTagTab,
  newTag,
  setNewTag,
  saving,
  tagError,
  onClose,
  onCreate
}: CreateTagModalProps) {
  const t = useTranslations('admin.tagModal')
  const tTags = useTranslations('admin.tags')
  const tCommon = useTranslations('common')

  const isAccount = currentTagTab.namespace === 'account'
  const exampleValue = isAccount ? 'chase-checking' : 'vacation'
  const exampleDisplay = isAccount ? 'Chase Checking Account' : ''

  // Resolve label from translation key
  const label = tTags(currentTagTab.labelKey as 'allTagsLabel')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-theme mb-4">
          {t('addLabel', { type: label.replace(/s$/, '') })}
        </h2>

        {tagError && (
          <div className="mb-4 p-3 bg-negative text-negative rounded-md text-sm">
            {tagError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme mb-1">
              {t('value')}
            </label>
            <input
              type="text"
              value={newTag.value}
              onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
              placeholder={t('valuePlaceholder', { example: exampleValue })}
              className="input w-full"
            />
            <p className="mt-1 text-xs text-theme-muted">
              {t('normalized', { value: newTag.value.trim().toLowerCase().replace(/\s+/g, '-') || '...' })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme mb-1">
              {isAccount ? t('displayNameOptional') : t('descriptionOptional')}
            </label>
            <input
              type="text"
              value={newTag.description}
              onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
              placeholder={isAccount ? t('displayNamePlaceholder', { example: exampleDisplay }) : t('descriptionPlaceholder')}
              className="input w-full"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-theme hover:bg-[var(--color-bg-hover)] rounded-md"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={onCreate}
            disabled={saving || !newTag.value.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? t('creating') : t('create')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface EditTagModalProps {
  editingTag: Tag
  setEditingTag: (tag: Tag | null) => void
  saving: boolean
  tagError: string | null
  onClose: () => void
  onSave: () => void
}

export function EditTagModal({
  editingTag,
  setEditingTag,
  saving,
  tagError,
  onClose,
  onSave
}: EditTagModalProps) {
  const t = useTranslations('admin.tagModal')
  const tCommon = useTranslations('common')

  const isAccount = editingTag.namespace === 'account'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold text-theme mb-4">
          {t('edit')}
        </h2>

        {tagError && (
          <div className="mb-4 p-3 bg-negative text-negative rounded-md text-sm">
            {tagError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme mb-1">
              {t('namespace')}
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
              {t('valueId')}
            </label>
            <input
              type="text"
              value={editingTag.value}
              onChange={(e) => setEditingTag({ ...editingTag, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              className="input w-full font-mono"
              placeholder={t('valuePlaceholder', { example: 'groceries, vacation' })}
            />
            <p className="mt-1 text-xs text-theme-muted">{t('valueIdHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme mb-1">
              {isAccount ? t('displayName') : t('description')}
            </label>
            <input
              type="text"
              value={editingTag.description || ''}
              onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
              placeholder={isAccount ? t('displayNamePlaceholder', { example: 'Display name for this account' }) : t('descriptionPlaceholder')}
              className="input w-full"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-theme hover:bg-[var(--color-bg-hover)] rounded-md"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving || !editingTag.value.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? t('saving') : tCommon('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
