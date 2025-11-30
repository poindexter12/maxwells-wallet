'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'

type ToolsTab = 'transfers' | 'rules'

// Transfer types
interface TransferSuggestion {
  id: number
  date: string
  amount: number
  description: string
  merchant: string | null
  account_source: string
  match_reason: string
}

interface TransferStats {
  transfer_count: number
  transfer_total: number
  linked_pairs: number
}

// Rule types
interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface TagRule {
  id: number
  name: string
  tag: string
  priority: number
  enabled: boolean
  merchant_pattern?: string
  description_pattern?: string
  amount_min?: number
  amount_max?: number
  account_source?: string
  match_all: boolean
  match_count: number
  last_matched_date?: string
}

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolsTab>('transfers')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-theme">Tools</h1>
        <p className="mt-1 text-sm text-theme-muted">
          Automation and cleanup utilities
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transfers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transfers'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
            }`}
          >
            Transfers
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'rules'
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
            }`}
          >
            Rules
          </button>
        </nav>
      </div>

      {activeTab === 'transfers' && <TransfersContent />}
      {activeTab === 'rules' && <RulesContent />}
    </div>
  )
}

function TransfersContent() {
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([])
  const [stats, setStats] = useState<TransferStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [suggestionsRes, statsRes] = await Promise.all([
        fetch('/api/v1/transfers/suggestions?limit=100'),
        fetch('/api/v1/transfers/stats')
      ])
      const suggestionsData = await suggestionsRes.json()
      const statsData = await statsRes.json()
      setSuggestions(suggestionsData.suggestions || [])
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching transfer data:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelection(id: number) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  function selectAll() {
    if (selectedIds.size === suggestions.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(suggestions.map(s => s.id)))
  }

  async function markAsTransfers() {
    if (selectedIds.size === 0) return
    setProcessing(true)
    try {
      await fetch('/api/v1/transfers/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: Array.from(selectedIds), is_transfer: true })
      })
      setSelectedIds(new Set())
      await fetchData()
    } catch (error) {
      console.error('Error marking transfers:', error)
    } finally {
      setProcessing(false)
    }
  }

  function dismissSuggestions() {
    setSuggestions(suggestions.filter(s => !selectedIds.has(s.id)))
    setSelectedIds(new Set())
  }

  if (loading) return <div className="text-center py-12 text-theme-muted">Loading...</div>

  return (
    <div className="space-y-6">
      <p className="text-sm text-theme-muted">
        Identify internal transfers to exclude from spending calculations
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-sm text-theme-muted">Marked as Transfer</div>
            <div className="text-2xl font-bold text-theme">{stats.transfer_count}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-theme-muted">Transfer Total</div>
            <div className="text-2xl font-bold text-theme">{formatCurrency(stats.transfer_total)}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-theme-muted">Linked Pairs</div>
            <div className="text-2xl font-bold text-theme">{stats.linked_pairs}</div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="card">
        <div className="p-4 border-b border-theme flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-theme">Suggested Transfers</h2>
            <p className="text-sm text-theme-muted">{suggestions.length} transactions look like transfers</p>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <button onClick={dismissSuggestions} className="px-3 py-1.5 text-sm border border-theme rounded-md hover:bg-theme-elevated">
                Dismiss ({selectedIds.size})
              </button>
              <button onClick={markAsTransfers} disabled={processing} className="btn-primary text-sm disabled:opacity-50">
                {processing ? 'Processing...' : `Mark as Transfers (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>

        {suggestions.length === 0 ? (
          <div className="p-8 text-center text-theme-muted">
            No transfer suggestions found. All detected transfers have been processed.
          </div>
        ) : (
          <div className="divide-y divide-theme">
            <div className="px-4 py-2 bg-theme-elevated flex items-center gap-4 text-sm font-medium text-theme-muted">
              <input type="checkbox" checked={selectedIds.size === suggestions.length && suggestions.length > 0} onChange={selectAll} className="rounded" />
              <span className="w-24">Date</span>
              <span className="w-28 text-right">Amount</span>
              <span className="flex-1">Description</span>
              <span className="w-32">Account</span>
              <span className="w-48">Match Reason</span>
            </div>
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`px-4 py-3 flex items-center gap-4 hover:bg-theme-elevated cursor-pointer ${selectedIds.has(suggestion.id) ? 'bg-theme-elevated' : ''}`}
                onClick={() => toggleSelection(suggestion.id)}
              >
                <input type="checkbox" checked={selectedIds.has(suggestion.id)} onChange={() => toggleSelection(suggestion.id)} onClick={(e) => e.stopPropagation()} className="rounded" />
                <span className="w-24 text-sm text-theme-muted">{format(new Date(suggestion.date), 'MMM d, yyyy')}</span>
                <span className={`w-28 text-right font-mono text-sm ${suggestion.amount < 0 ? 'text-negative' : 'text-positive'}`}>{formatCurrency(suggestion.amount)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-theme truncate">{suggestion.merchant || suggestion.description}</div>
                  {suggestion.merchant && <div className="text-xs text-theme-muted truncate">{suggestion.description}</div>}
                </div>
                <span className="w-32 text-sm text-theme-muted truncate">{suggestion.account_source}</span>
                <span className="w-48 text-xs text-theme-muted truncate" title={suggestion.match_reason}>{suggestion.match_reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RulesContent() {
  const [rules, setRules] = useState<TagRule[]>([])
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<TagRule | null>(null)
  const [testResults, setTestResults] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '', tag: '', priority: '0', enabled: true,
    merchant_pattern: '', description_pattern: '',
    amount_min: '', amount_max: '', account_source: '', match_all: false
  })

  useEffect(() => {
    fetchBucketTags()
    fetchRules()
  }, [])

  async function fetchBucketTags() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      setBucketTags(await res.json())
    } catch (error) {
      console.error('Error fetching bucket tags:', error)
    }
  }

  async function fetchRules() {
    try {
      const res = await fetch('/api/v1/tag-rules')
      setRules(await res.json())
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: any = { name: formData.name, tag: formData.tag, priority: parseInt(formData.priority), enabled: formData.enabled, match_all: formData.match_all }
    if (formData.merchant_pattern) payload.merchant_pattern = formData.merchant_pattern
    if (formData.description_pattern) payload.description_pattern = formData.description_pattern
    if (formData.amount_min) payload.amount_min = parseFloat(formData.amount_min)
    if (formData.amount_max) payload.amount_max = parseFloat(formData.amount_max)
    if (formData.account_source) payload.account_source = formData.account_source

    try {
      if (editingRule) {
        await fetch(`/api/v1/tag-rules/${editingRule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      } else {
        await fetch('/api/v1/tag-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      }
      setShowForm(false)
      setEditingRule(null)
      resetForm()
      fetchRules()
    } catch (error) {
      console.error('Error saving rule:', error)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/v1/tag-rules/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  async function handleToggleEnabled(rule: TagRule) {
    await fetch(`/api/v1/tag-rules/${rule.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !rule.enabled }) })
    fetchRules()
  }

  async function handleTestRule(ruleId: number) {
    const res = await fetch(`/api/v1/tag-rules/${ruleId}/test`, { method: 'POST' })
    setTestResults({ ruleId, ...(await res.json()) })
  }

  async function handleApplyRules() {
    if (!confirm('Apply all active rules to untagged transactions?')) return
    const res = await fetch('/api/v1/tag-rules/apply', { method: 'POST' })
    const data = await res.json()
    alert(`Applied rules to ${data.applied_count} transactions`)
    fetchRules()
  }

  function handleEdit(rule: TagRule) {
    setEditingRule(rule)
    setFormData({
      name: rule.name, tag: rule.tag, priority: rule.priority.toString(), enabled: rule.enabled,
      merchant_pattern: rule.merchant_pattern || '', description_pattern: rule.description_pattern || '',
      amount_min: rule.amount_min?.toString() || '', amount_max: rule.amount_max?.toString() || '',
      account_source: rule.account_source || '', match_all: rule.match_all
    })
    setShowForm(true)
  }

  function resetForm() {
    setFormData({ name: '', tag: '', priority: '0', enabled: true, merchant_pattern: '', description_pattern: '', amount_min: '', amount_max: '', account_source: '', match_all: false })
  }

  function getRuleConditions(rule: TagRule): string[] {
    const conditions = []
    if (rule.merchant_pattern) conditions.push(`Merchant: "${rule.merchant_pattern}"`)
    if (rule.description_pattern) conditions.push(`Description: "${rule.description_pattern}"`)
    if (rule.amount_min || rule.amount_max) conditions.push(`Amount: ${rule.amount_min || 'any'} - ${rule.amount_max || 'any'}`)
    if (rule.account_source) conditions.push(`Account: "${rule.account_source}"`)
    return conditions
  }

  if (loading) return <div className="text-center py-12 text-theme-muted">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">Automatically assign buckets to transactions based on patterns</p>
        <div className="flex gap-3">
          <button onClick={handleApplyRules} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">Apply All Rules</button>
          <button onClick={() => { setEditingRule(null); resetForm(); setShowForm(true) }} className="btn-primary text-sm">New Rule</button>
        </div>
      </div>

      {/* Rules List */}
      <div className="card">
        {rules.length === 0 ? (
          <p className="text-theme-muted text-center py-12">No rules created yet</p>
        ) : (
          <div className="divide-y divide-theme">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-theme">{rule.name}</h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded dark:bg-blue-900/30 dark:text-blue-300">
                        {rule.tag.split(':')[1] || rule.tag}
                      </span>
                      <span className="px-2 py-0.5 bg-theme-elevated text-xs rounded">Priority: {rule.priority}</span>
                      {!rule.enabled && <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded dark:bg-red-900/30 dark:text-red-300">Disabled</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {getRuleConditions(rule).map((c, i) => <span key={i} className="text-xs bg-theme-elevated px-2 py-1 rounded">{c}</span>)}
                      <span className="text-xs text-theme-muted">({rule.match_all ? 'ALL' : 'ANY'})</span>
                    </div>
                    <div className="text-xs text-theme-muted">Matched: {rule.match_count} transactions</div>
                    {testResults?.ruleId === rule.id && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                        Test: {testResults.match_count} transactions would match
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => handleToggleEnabled(rule)} className={`px-2 py-1 text-xs rounded ${rule.enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-theme-elevated'}`}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button onClick={() => handleTestRule(rule.id)} className="text-theme-muted hover:text-theme text-sm">Test</button>
                    <button onClick={() => handleEdit(rule)} className="text-theme-muted hover:text-theme text-sm">Edit</button>
                    <button onClick={() => handleDelete(rule.id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-theme mb-4">{editingRule ? 'Edit Rule' : 'Create Rule'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">Rule Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">Target Bucket *</label>
                  <select value={formData.tag} onChange={(e) => setFormData({ ...formData, tag: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" required>
                    <option value="">Select...</option>
                    {bucketTags.map((tag) => <option key={tag.id} value={`bucket:${tag.value}`}>{tag.value}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">Priority</label>
                <input type="number" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" />
              </div>
              <div className="border-t border-theme pt-4">
                <p className="text-sm font-medium text-theme mb-3">Matching Conditions</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-theme-muted mb-1">Merchant Pattern</label>
                    <input type="text" value={formData.merchant_pattern} onChange={(e) => setFormData({ ...formData, merchant_pattern: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" placeholder="e.g., Starbucks" />
                  </div>
                  <div>
                    <label className="block text-sm text-theme-muted mb-1">Description Pattern</label>
                    <input type="text" value={formData.description_pattern} onChange={(e) => setFormData({ ...formData, description_pattern: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" placeholder="e.g., Coffee" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-theme-muted mb-1">Amount Min</label>
                      <input type="number" step="0.01" value={formData.amount_min} onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" />
                    </div>
                    <div>
                      <label className="block text-sm text-theme-muted mb-1">Amount Max</label>
                      <input type="number" step="0.01" value={formData.amount_max} onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-theme-muted mb-1">Account Source</label>
                    <input type="text" value={formData.account_source} onChange={(e) => setFormData({ ...formData, account_source: e.target.value })} className="w-full px-3 py-2 bg-theme border border-theme rounded-md" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 border-t border-theme pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.match_all} onChange={(e) => setFormData({ ...formData, match_all: e.target.checked })} />
                  All conditions must match (AND logic)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })} />
                  Enable rule immediately
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowForm(false); setEditingRule(null) }} className="flex-1 px-4 py-2 border border-theme rounded-md hover:bg-theme-elevated">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">{editingRule ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
