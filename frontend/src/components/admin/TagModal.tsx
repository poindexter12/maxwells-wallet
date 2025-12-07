'use client'

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
  return (
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
            onClick={onClose}
            className="px-4 py-2 text-theme hover:bg-[var(--color-bg-hover)] rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={saving || !newTag.value.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
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
  return (
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
            onClick={onClose}
            className="px-4 py-2 text-theme hover:bg-[var(--color-bg-hover)] rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !editingTag.value.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
