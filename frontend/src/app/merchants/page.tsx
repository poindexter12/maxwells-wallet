'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

interface MerchantAlias {
  id: number
  pattern: string
  canonical_name: string
  match_type: 'exact' | 'contains' | 'regex'
  priority: number
  match_count: number
  last_matched_date: string | null
}

interface Merchant {
  name: string
  transaction_count: number
}

interface AliasSuggestion {
  raw_merchant: string
  transaction_count: number
  suggested_canonical: string | null
  reason: string | null
}

export default function MerchantsPage() {
  const [aliases, setAliases] = useState<MerchantAlias[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [suggestions, setSuggestions] = useState<AliasSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'aliases' | 'merchants' | 'suggestions'>('aliases')
  const [showForm, setShowForm] = useState(false)
  const [editingAlias, setEditingAlias] = useState<MerchantAlias | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<{ updated_count: number; dry_run: boolean } | null>(null)

  // Form state
  const [formPattern, setFormPattern] = useState('')
  const [formCanonicalName, setFormCanonicalName] = useState('')
  const [formMatchType, setFormMatchType] = useState<'exact' | 'contains' | 'regex'>('contains')
  const [formPriority, setFormPriority] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [aliasesRes, merchantsRes, suggestionsRes] = await Promise.all([
        fetch('/api/v1/merchants/aliases'),
        fetch('/api/v1/merchants?limit=100'),
        fetch('/api/v1/merchants/aliases/suggestions?min_count=2')
      ])

      const aliasesData = await aliasesRes.json()
      const merchantsData = await merchantsRes.json()
      const suggestionsData = await suggestionsRes.json()

      setAliases(aliasesData || [])
      setMerchants(merchantsData.merchants || [])
      setSuggestions(suggestionsData.suggestions || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching data:', error)
      setLoading(false)
    }
  }

  function resetForm() {
    setFormPattern('')
    setFormCanonicalName('')
    setFormMatchType('contains')
    setFormPriority(0)
    setEditingAlias(null)
    setShowForm(false)
  }

  function startEdit(alias: MerchantAlias) {
    setFormPattern(alias.pattern)
    setFormCanonicalName(alias.canonical_name)
    setFormMatchType(alias.match_type)
    setFormPriority(alias.priority)
    setEditingAlias(alias)
    setShowForm(true)
  }

  function startCreate(pattern?: string, canonical?: string) {
    setFormPattern(pattern || '')
    setFormCanonicalName(canonical || '')
    setFormMatchType('contains')
    setFormPriority(0)
    setEditingAlias(null)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      pattern: formPattern,
      canonical_name: formCanonicalName,
      match_type: formMatchType,
      priority: formPriority
    }

    try {
      if (editingAlias) {
        await fetch(`/api/v1/merchants/aliases/${editingAlias.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch('/api/v1/merchants/aliases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      resetForm()
      await fetchData()
    } catch (error) {
      console.error('Error saving alias:', error)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this alias?')) return

    try {
      await fetch(`/api/v1/merchants/aliases/${id}`, { method: 'DELETE' })
      await fetchData()
    } catch (error) {
      console.error('Error deleting alias:', error)
    }
  }

  async function applyAliases(dryRun: boolean) {
    setApplying(true)
    setApplyResult(null)

    try {
      const res = await fetch(`/api/v1/merchants/aliases/apply?dry_run=${dryRun}`, {
        method: 'POST'
      })
      const data = await res.json()
      setApplyResult({ updated_count: data.updated_count, dry_run: dryRun })

      if (!dryRun) {
        await fetchData()
      }
    } catch (error) {
      console.error('Error applying aliases:', error)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="merchants"
        title="Merchant Alias Help"
        description="Create aliases to normalize messy bank merchant names into clean, consistent names across all your transactions."
        steps={[
          "Review your transaction merchants in the 'Merchants' tab",
          "Create aliases with patterns that match raw merchant strings",
          "Use 'Preview' to see what would change before applying",
          "Apply aliases to update all matching transactions"
        ]}
        tips={[
          "Use 'contains' match for most cases (e.g., 'AMZN' matches 'AMZN*MKTP')",
          "Higher priority aliases are applied first",
          "Aliases are automatically applied during CSV import"
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Merchant Aliases</h1>
          <p className="mt-2 text-sm text-theme-muted">
            Normalize messy bank merchant names
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => applyAliases(true)}
            disabled={applying || aliases.length === 0}
            className="px-4 py-2 border border-theme rounded-md hover:bg-theme-elevated disabled:opacity-50"
          >
            {applying ? 'Checking...' : 'Preview Changes'}
          </button>
          <button
            onClick={() => applyAliases(false)}
            disabled={applying || aliases.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {applying ? 'Applying...' : 'Apply to All'}
          </button>
        </div>
      </div>

      {applyResult && (
        <div className={`p-4 rounded-md ${applyResult.dry_run ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
          <p className="text-sm">
            {applyResult.dry_run
              ? `Preview: ${applyResult.updated_count} transactions would be updated`
              : `Applied: ${applyResult.updated_count} transactions updated`}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="flex -mb-px space-x-8">
          <button
            onClick={() => setActiveTab('aliases')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'aliases'
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-theme'
            }`}
          >
            Aliases ({aliases.length})
          </button>
          <button
            onClick={() => setActiveTab('merchants')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'merchants'
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-theme'
            }`}
          >
            Merchants ({merchants.length})
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'suggestions'
                ? 'border-accent text-accent'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-theme'
            }`}
          >
            Suggestions ({suggestions.length})
          </button>
        </nav>
      </div>

      {/* Aliases Tab */}
      {activeTab === 'aliases' && (
        <div className="card">
          <div className="p-4 border-b border-theme flex justify-between items-center">
            <h2 className="text-lg font-semibold text-theme">Merchant Aliases</h2>
            <button
              onClick={() => startCreate()}
              className="btn-primary text-sm"
            >
              + Add Alias
            </button>
          </div>

          {showForm && (
            <div className="p-4 border-b border-theme bg-theme-elevated">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-theme mb-1">Pattern</label>
                    <input
                      type="text"
                      value={formPattern}
                      onChange={(e) => setFormPattern(e.target.value)}
                      placeholder="e.g., AMZN or Amazon.*Prime"
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme mb-1">Canonical Name</label>
                    <input
                      type="text"
                      value={formCanonicalName}
                      onChange={(e) => setFormCanonicalName(e.target.value)}
                      placeholder="e.g., Amazon"
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme mb-1">Match Type</label>
                    <select
                      value={formMatchType}
                      onChange={(e) => setFormMatchType(e.target.value as typeof formMatchType)}
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                    >
                      <option value="exact">Exact Match</option>
                      <option value="contains">Contains</option>
                      <option value="regex">Regex</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme mb-1">Priority</label>
                    <input
                      type="number"
                      value={formPriority}
                      onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                    />
                    <p className="text-xs text-theme-muted mt-1">Higher priority aliases are applied first</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-theme rounded-md hover:bg-theme-elevated"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingAlias ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {aliases.length === 0 ? (
            <div className="p-8 text-center text-theme-muted">
              No aliases defined. Create one to start normalizing merchant names.
            </div>
          ) : (
            <div className="divide-y divide-theme">
              {aliases.map((alias) => (
                <div key={alias.id} className="p-4 flex items-center justify-between hover:bg-theme-elevated">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm bg-theme-elevated px-2 py-1 rounded">
                        {alias.pattern}
                      </span>
                      <span className="text-theme-muted">→</span>
                      <span className="font-medium text-theme">{alias.canonical_name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-theme-muted">
                      <span className={`px-2 py-0.5 rounded ${
                        alias.match_type === 'exact' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        alias.match_type === 'contains' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                      }`}>
                        {alias.match_type}
                      </span>
                      <span>Priority: {alias.priority}</span>
                      <span>Matched: {alias.match_count}x</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(alias)}
                      className="px-3 py-1 text-sm text-theme-muted hover:text-theme"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(alias.id)}
                      className="px-3 py-1 text-sm text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Merchants Tab */}
      {activeTab === 'merchants' && (
        <div className="card">
          <div className="p-4 border-b border-theme">
            <h2 className="text-lg font-semibold text-theme">All Merchants</h2>
            <p className="text-sm text-theme-muted">
              Click a merchant to create an alias for it
            </p>
          </div>
          <div className="divide-y divide-theme max-h-[600px] overflow-y-auto">
            {merchants.map((merchant, idx) => (
              <div
                key={idx}
                className="p-4 flex items-center justify-between hover:bg-theme-elevated cursor-pointer"
                onClick={() => startCreate(merchant.name, merchant.name)}
              >
                <span className="font-mono text-sm text-theme">{merchant.name}</span>
                <span className="text-sm text-theme-muted">{merchant.transaction_count} transactions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="card">
          <div className="p-4 border-b border-theme">
            <h2 className="text-lg font-semibold text-theme">Suggested Aliases</h2>
            <p className="text-sm text-theme-muted">
              These merchants might benefit from cleanup
            </p>
          </div>
          {suggestions.length === 0 ? (
            <div className="p-8 text-center text-theme-muted">
              No suggestions available. Your merchant names look clean!
            </div>
          ) : (
            <div className="divide-y divide-theme">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="p-4 hover:bg-theme-elevated">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm text-theme">{suggestion.raw_merchant}</div>
                      {suggestion.suggested_canonical && (
                        <div className="mt-1 text-sm">
                          <span className="text-theme-muted">Suggested:</span>{' '}
                          <span className="text-accent">{suggestion.suggested_canonical}</span>
                          {suggestion.reason && (
                            <span className="text-theme-muted ml-2">({suggestion.reason})</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-theme-muted">{suggestion.transaction_count} txns</span>
                      <button
                        onClick={() => startCreate(
                          suggestion.raw_merchant,
                          suggestion.suggested_canonical || suggestion.raw_merchant
                        )}
                        className="px-3 py-1 text-sm border border-theme rounded hover:bg-theme-elevated"
                      >
                        Create Alias
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
