'use client'

import { useState, useEffect } from 'react'
import { PageHelp } from '@/components/PageHelp'

interface Tag {
  id: number
  namespace: string
  value: string
  description: string | null
  created_at: string
  updated_at: string
}

interface TagWithUsage extends Tag {
  usage_count?: number
}

interface Namespace {
  name: string
  description: string
  builtIn: boolean
  tagCount: number
}

const BUILT_IN_NAMESPACES: Record<string, string> = {
  bucket: 'Spending categories for organizing transactions',
  account: 'Bank accounts and credit cards',
  occasion: 'Special events like vacation, holidays',
  expense: 'Expense types like recurring, one-time',
}

export default function TagsPage() {
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [tags, setTags] = useState<TagWithUsage[]>([])
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tagsLoading, setTagsLoading] = useState(false)

  // Namespace modal state
  const [showNamespaceModal, setShowNamespaceModal] = useState(false)
  const [newNamespace, setNewNamespace] = useState({ name: '', description: '' })
  const [namespaceError, setNamespaceError] = useState<string | null>(null)
  const [namespaceSaving, setNamespaceSaving] = useState(false)

  // Tag modal state
  const [showTagModal, setShowTagModal] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [newTag, setNewTag] = useState({ value: '', description: '' })
  const [tagError, setTagError] = useState<string | null>(null)
  const [tagSaving, setTagSaving] = useState(false)

  async function fetchAllTags() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/tags')
      const data: Tag[] = await res.json()

      // Build namespace list from tags
      const nsMap = new Map<string, number>()
      data.forEach(tag => {
        nsMap.set(tag.namespace, (nsMap.get(tag.namespace) || 0) + 1)
      })

      // Add built-in namespaces even if empty
      Object.keys(BUILT_IN_NAMESPACES).forEach(ns => {
        if (!nsMap.has(ns)) {
          nsMap.set(ns, 0)
        }
      })

      const nsList: Namespace[] = Array.from(nsMap.entries()).map(([name, count]) => ({
        name,
        description: BUILT_IN_NAMESPACES[name] || '',
        builtIn: name in BUILT_IN_NAMESPACES,
        tagCount: count,
      }))

      // Sort: built-in first, then alphabetically
      nsList.sort((a, b) => {
        if (a.builtIn && !b.builtIn) return -1
        if (!a.builtIn && b.builtIn) return 1
        return a.name.localeCompare(b.name)
      })

      setNamespaces(nsList)

      // Auto-select first namespace if none selected
      if (!selectedNamespace && nsList.length > 0) {
        setSelectedNamespace(nsList[0].name)
      }
    } catch (err) {
      console.error('Error fetching tags:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTagsForNamespace(namespace: string) {
    setTagsLoading(true)
    try {
      const res = await fetch(`/api/v1/tags?namespace=${namespace}`)
      const data: Tag[] = await res.json()

      const tagsWithUsage = await Promise.all(
        data.map(async (tag) => {
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
    fetchAllTags()
  }, [])

  useEffect(() => {
    if (selectedNamespace) {
      fetchTagsForNamespace(selectedNamespace)
    }
  }, [selectedNamespace])

  async function handleCreateNamespace() {
    if (!newNamespace.name.trim()) return

    setNamespaceSaving(true)
    setNamespaceError(null)

    const nsName = newNamespace.name.trim().toLowerCase().replace(/\s+/g, '-')

    // Check if namespace already exists
    if (namespaces.some(ns => ns.name === nsName)) {
      setNamespaceError(`Namespace "${nsName}" already exists`)
      setNamespaceSaving(false)
      return
    }

    // Create a placeholder tag to establish the namespace
    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: nsName,
          value: '_placeholder',
          description: newNamespace.description.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to create namespace')
      }

      // Delete the placeholder immediately
      const tag = await res.json()
      await fetch(`/api/v1/tags/${tag.id}`, { method: 'DELETE' })

      setShowNamespaceModal(false)
      setNewNamespace({ name: '', description: '' })
      fetchAllTags()
      setSelectedNamespace(nsName)
    } catch (err) {
      setNamespaceError(err instanceof Error ? err.message : 'Failed to create namespace')
    } finally {
      setNamespaceSaving(false)
    }
  }

  async function handleDeleteNamespace(ns: Namespace) {
    if (ns.builtIn) {
      alert('Cannot delete built-in namespaces')
      return
    }

    if (ns.tagCount > 0) {
      alert(`Cannot delete namespace "${ns.name}": it still has ${ns.tagCount} tag(s)`)
      return
    }

    if (!confirm(`Delete namespace "${ns.name}"?`)) return

    // Namespace is already empty, just refresh
    fetchAllTags()
    if (selectedNamespace === ns.name) {
      setSelectedNamespace(namespaces[0]?.name || null)
    }
  }

  async function handleCreateTag() {
    if (!newTag.value.trim() || !selectedNamespace) return

    setTagSaving(true)
    setTagError(null)

    try {
      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: selectedNamespace,
          value: newTag.value.trim().toLowerCase().replace(/\s+/g, '-'),
          description: newTag.description.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to create tag')
      }

      setShowTagModal(false)
      setNewTag({ value: '', description: '' })
      fetchTagsForNamespace(selectedNamespace)
      fetchAllTags() // Update counts
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setTagSaving(false)
    }
  }

  async function handleUpdateTag() {
    if (!editingTag || !selectedNamespace) return

    setTagSaving(true)
    setTagError(null)

    try {
      const newValue = editingTag.value.trim().toLowerCase().replace(/\s+/g, '-')
      const res = await fetch(`/api/v1/tags/${editingTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: newValue,
          description: editingTag.description?.trim() || null
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to update tag')
      }

      setEditingTag(null)
      fetchTagsForNamespace(selectedNamespace)
      fetchAllTags() // Update counts in case value changed
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Failed to update tag')
    } finally {
      setTagSaving(false)
    }
  }

  async function handleDeleteTag(tag: TagWithUsage) {
    if ((tag.usage_count ?? 0) > 0) {
      alert(`Cannot delete tag: it is used by ${tag.usage_count} transaction(s)`)
      return
    }

    if (!confirm(`Delete "${tag.namespace}:${tag.value}"?`)) return

    try {
      const res = await fetch(`/api/v1/tags/${tag.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to delete tag')
      }

      fetchTagsForNamespace(selectedNamespace!)
      fetchAllTags() // Update counts
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete tag')
    }
  }

  const currentNamespace = namespaces.find(ns => ns.name === selectedNamespace)

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="tags"
        title="Tags Help"
        description="Advanced tag management with full namespace control. For most users, the Admin page provides a simpler interface."
        steps={[
          "Select a namespace on the left to view its tags",
          "Click 'Add Value' to create a new tag in the selected namespace",
          "Edit or delete tags using the action buttons",
          "Create custom namespaces for specialized categorization"
        ]}
        tips={[
          "Built-in namespaces (bucket, account, occasion, expense) cover most use cases",
          "Tags in use cannot be deleted until removed from all transactions",
          "Use the Admin page for a simpler tag management experience"
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tags</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage tag namespaces and their values
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Namespaces Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <h2 className="text-sm font-semibold text-gray-900 uppercase">Namespaces</h2>
                <button
                  onClick={() => {
                    setNewNamespace({ name: '', description: '' })
                    setNamespaceError(null)
                    setShowNamespaceModal(true)
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  + Add
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {namespaces.map((ns) => (
                  <div
                    key={ns.name}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 flex justify-between items-center ${
                      selectedNamespace === ns.name ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                    onClick={() => setSelectedNamespace(ns.name)}
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {ns.name}
                        {ns.builtIn && (
                          <span className="ml-2 text-xs text-gray-400">(built-in)</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{ns.tagCount} tags</div>
                    </div>
                    {!ns.builtIn && ns.tagCount === 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNamespace(ns)
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tags Panel */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 uppercase">
                    {selectedNamespace ? `${selectedNamespace} values` : 'Select a namespace'}
                  </h2>
                  {currentNamespace?.description && (
                    <p className="text-xs text-gray-500 mt-1">{currentNamespace.description}</p>
                  )}
                </div>
                {selectedNamespace && (
                  <button
                    onClick={() => {
                      setNewTag({ value: '', description: '' })
                      setTagError(null)
                      setShowTagModal(true)
                    }}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add Value
                  </button>
                )}
              </div>

              {tagsLoading ? (
                <div className="text-center py-12 text-gray-500">Loading...</div>
              ) : !selectedNamespace ? (
                <div className="text-center py-12 text-gray-500">
                  Select a namespace to view its tags
                </div>
              ) : tags.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No tags in this namespace yet
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Namespace</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value (ID)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tags.map((tag) => (
                      <tr key={tag.id}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-500">{tag.namespace}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-gray-100 text-gray-800 font-mono">
                            {tag.value}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {tag.description || <span className="text-gray-400 italic">—</span>}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {tag.usage_count ?? 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm space-x-2">
                          <button
                            onClick={() => {
                              setEditingTag(tag)
                              setTagError(null)
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag)}
                            disabled={(tag.usage_count ?? 0) > 0}
                            className="text-red-600 hover:text-red-800 disabled:text-gray-300"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Namespace Modal */}
      {showNamespaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Namespace</h2>

            {namespaceError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {namespaceError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newNamespace.name}
                  onChange={(e) => setNewNamespace({ ...newNamespace, name: e.target.value })}
                  placeholder="e.g., project, label"
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Will be: {newNamespace.name.trim().toLowerCase().replace(/\s+/g, '-') || '...'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newNamespace.description}
                  onChange={(e) => setNewNamespace({ ...newNamespace, description: e.target.value })}
                  placeholder="What this namespace is for"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowNamespaceModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNamespace}
                disabled={namespaceSaving || !newNamespace.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {namespaceSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showTagModal && selectedNamespace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Add to {selectedNamespace}
            </h2>

            {tagError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {tagError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="text"
                  value={newTag.value}
                  onChange={(e) => setNewTag({ ...newTag, value: e.target.value })}
                  placeholder="e.g., groceries, vacation"
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Full tag: {selectedNamespace}:{newTag.value.trim().toLowerCase().replace(/\s+/g, '-') || '...'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newTag.description}
                  onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTag}
                disabled={tagSaving || !newTag.value.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {tagSaving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Edit Tag
            </h2>

            {tagError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {tagError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Namespace</label>
                <input
                  type="text"
                  value={editingTag.namespace}
                  disabled
                  className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value (ID)</label>
                <input
                  type="text"
                  value={editingTag.value}
                  onChange={(e) => setEditingTag({ ...editingTag, value: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique identifier within namespace. Will be normalized to: {editingTag.value.trim().toLowerCase().replace(/\s+/g, '-')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editingTag.description || ''}
                  onChange={(e) => setEditingTag({ ...editingTag, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingTag(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTag}
                disabled={tagSaving || !editingTag.value.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {tagSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
