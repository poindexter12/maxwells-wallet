'use client'

import { useEffect, useState } from 'react'

interface Account {
  id: number
  name: string  // The tag value (e.g., "bofa-checking")
  displayName: string  // The description field
  transactionCount: number
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({ name: '', displayName: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/v1/tags?namespace=account')
      const tags = await res.json()

      // Get usage counts for each account
      const accountsWithCounts = await Promise.all(
        tags.map(async (tag: { id: number; value: string; description: string | null }) => {
          try {
            const countRes = await fetch(`/api/v1/tags/${tag.id}/usage-count`)
            const countData = await countRes.json()
            return {
              id: tag.id,
              name: tag.value,
              displayName: tag.description || tag.value,
              transactionCount: countData.usage_count || 0
            }
          } catch {
            return {
              id: tag.id,
              name: tag.value,
              displayName: tag.description || tag.value,
              transactionCount: 0
            }
          }
        })
      )

      setAccounts(accountsWithCounts.sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      console.error('Error fetching accounts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate() {
    if (!editingId || !formData.name.trim() || !formData.displayName.trim()) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/v1/tags/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: formData.name.trim(),
          description: formData.displayName.trim()
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to update account')
      }

      setEditingId(null)
      setFormData({ name: '', displayName: '' })
      fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(account: Account) {
    setEditingId(account.id)
    setFormData({ name: account.name, displayName: account.displayName })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormData({ name: '', displayName: '' })
    setError(null)
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Bank accounts and credit cards. Accounts are auto-created when you import transactions.
          </p>
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">No accounts yet. Import some transactions to create accounts automatically!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-lg shadow p-4">
              {editingId === account.id ? (
                <div className="space-y-3">
                  {error && (
                    <div className="p-2 bg-red-50 text-red-700 rounded text-sm">{error}</div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Account ID</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                      className="w-full px-2 py-1 border rounded text-sm font-mono"
                      placeholder="e.g., bofa-checking"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="e.g., Chase Sapphire, BofA Checking"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      disabled={saving || !formData.name.trim() || !formData.displayName.trim()}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1 text-gray-600 text-sm hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-gray-900">{account.displayName}</h3>
                      <p className="text-xs text-gray-400 font-mono mt-1">{account.name}</p>
                    </div>
                    <span className="text-sm text-gray-400">
                      {account.transactionCount} txn{account.transactionCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => startEdit(account)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
