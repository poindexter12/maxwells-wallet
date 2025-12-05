'use client'

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'
import { CustomFormatMapper } from '@/components/CustomFormatMapper'

type ToolsTab = 'transfers' | 'rules' | 'merchants' | 'formats'

// Custom format types
interface SavedFormatConfig {
  id: number
  name: string
  description?: string
  config_json: string
  use_count: number
  created_at: string
  updated_at: string
}

// Merchant types
interface Merchant {
  name: string
  transaction_count: number
}

interface MerchantAlias {
  id: number
  pattern: string
  canonical_name: string
  match_type: 'exact' | 'contains' | 'regex'
  priority: number
  match_count: number
}

interface AliasPreviewUpdate {
  transaction_id: number
  description: string
  old_merchant: string | null
  new_merchant: string
  matched_pattern: string
}

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

const VALID_TABS: ToolsTab[] = ['transfers', 'rules', 'merchants', 'formats']

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolsTab>('transfers')

  // Read hash from URL on mount and listen for changes
  useEffect(() => {
    function updateTabFromHash() {
      const hash = window.location.hash.slice(1) // Remove #
      if (hash && VALID_TABS.includes(hash as ToolsTab)) {
        setActiveTab(hash as ToolsTab)
      }
    }

    // Set initial tab from hash
    updateTabFromHash()

    // Listen for hash changes (back/forward navigation)
    window.addEventListener('hashchange', updateTabFromHash)
    return () => window.removeEventListener('hashchange', updateTabFromHash)
  }, [])

  // Update URL hash when tab changes
  function handleTabChange(tab: ToolsTab) {
    setActiveTab(tab)
    window.history.pushState(null, '', `#${tab}`)
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="tools"
        title="Automation Tools"
        description="Utilities to automate categorization and clean up your transaction data."
        steps={[
          "Transfers: Identify and mark internal transfers between your accounts",
          "Rules: Create auto-categorization rules based on merchant, description, or amount",
          "Merchants: Normalize messy bank merchant names into clean, consistent names",
          "CSV Formats: Create reusable import configurations for different bank CSV formats"
        ]}
        tips={[
          "Transfers are excluded from spending calculations",
          "Rules run automatically when you import new transactions",
          "Preview merchant alias changes before applying them",
          "Custom CSV formats can be selected during import"
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold text-theme">Tools</h1>
        <p className="mt-1 text-sm text-theme-muted">
          Automation and cleanup utilities
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="-mb-px flex space-x-8">
          {VALID_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
              }`}
            >
              {tab === 'transfers' ? 'Transfers' :
               tab === 'rules' ? 'Rules' :
               tab === 'merchants' ? 'Merchants' :
               'CSV Formats'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'transfers' && <TransfersContent />}
      {activeTab === 'rules' && <RulesContent />}
      {activeTab === 'merchants' && <MerchantsContent />}
      {activeTab === 'formats' && <FormatsContent />}
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

function MerchantsContent() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [aliases, setAliases] = useState<MerchantAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAlias, setEditingAlias] = useState<MerchantAlias | null>(null)
  const [aliasForm, setAliasForm] = useState<{ pattern: string; canonical_name: string; match_type: 'exact' | 'contains' | 'regex'; priority: number }>({
    pattern: '', canonical_name: '', match_type: 'contains', priority: 0
  })
  const [previewResults, setPreviewResults] = useState<AliasPreviewUpdate[] | null>(null)
  const [applying, setApplying] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [merchantsRes, aliasesRes] = await Promise.all([
        fetch('/api/v1/merchants?limit=200'),
        fetch('/api/v1/merchants/aliases')
      ])
      const merchantsData = await merchantsRes.json()
      const aliasesData = await aliasesRes.json()
      setMerchants(merchantsData.merchants || [])
      setAliases(aliasesData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setAliasForm({ pattern: '', canonical_name: '', match_type: 'contains', priority: 0 })
    setEditingAlias(null)
    setShowForm(false)
  }

  async function handleSaveAlias(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editingAlias) {
        await fetch(`/api/v1/merchants/aliases/${editingAlias.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aliasForm)
        })
      } else {
        await fetch('/api/v1/merchants/aliases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aliasForm)
        })
      }
      resetForm()
      await fetchData()
    } catch (err) {
      console.error('Error saving alias:', err)
    }
  }

  async function handleDeleteAlias(id: number) {
    if (!confirm('Delete this alias?')) return
    await fetch(`/api/v1/merchants/aliases/${id}`, { method: 'DELETE' })
    await fetchData()
  }

  async function handlePreview() {
    setApplying(true)
    try {
      const res = await fetch('/api/v1/merchants/aliases/apply?dry_run=true', { method: 'POST' })
      const data = await res.json()
      setPreviewResults(data.updates || [])
    } catch (err) {
      console.error('Error previewing:', err)
    } finally {
      setApplying(false)
    }
  }

  async function handleApply() {
    if (!confirm(`Apply aliases to ${previewResults?.length || 0} transactions?`)) return
    setApplying(true)
    try {
      await fetch('/api/v1/merchants/aliases/apply?dry_run=false', { method: 'POST' })
      setPreviewResults(null)
      await fetchData()
    } catch (err) {
      console.error('Error applying:', err)
    } finally {
      setApplying(false)
    }
  }

  function startCreateFromMerchant(merchantName: string) {
    setAliasForm({ pattern: merchantName, canonical_name: merchantName, match_type: 'contains', priority: 0 })
    setEditingAlias(null)
    setShowForm(true)
  }

  const filteredMerchants = merchants.filter(m =>
    m.name.toLowerCase().includes(searchFilter.toLowerCase())
  )

  if (loading) return <div className="text-center py-12 text-theme-muted">Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">Normalize messy bank merchant names into clean, consistent names</p>
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={applying || aliases.length === 0}
            className="px-3 py-1.5 text-sm border border-theme rounded-md hover:bg-theme-elevated disabled:opacity-50"
          >
            {applying ? 'Checking...' : 'Preview Changes'}
          </button>
          <button
            onClick={() => { setEditingAlias(null); resetForm(); setShowForm(true) }}
            className="btn-primary text-sm"
          >
            + New Alias
          </button>
        </div>
      </div>

      {/* Preview Results */}
      {previewResults && previewResults.length > 0 && (
        <div className="card p-4 border-2 border-blue-500">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-theme">Preview: {previewResults.length} transactions would be updated</h3>
            <div className="flex gap-2">
              <button onClick={() => setPreviewResults(null)} className="px-3 py-1 text-sm border border-theme rounded">
                Dismiss
              </button>
              <button onClick={handleApply} disabled={applying} className="btn-primary text-sm disabled:opacity-50">
                {applying ? 'Applying...' : 'Apply Changes'}
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-theme">
            {previewResults.slice(0, 20).map((u, i) => (
              <div key={i} className="py-2 text-sm">
                <span className="text-theme-muted">{u.old_merchant || '(none)'}</span>
                <span className="mx-2">→</span>
                <span className="text-theme font-medium">{u.new_merchant}</span>
                <span className="ml-2 text-xs text-theme-muted">({u.matched_pattern})</span>
              </div>
            ))}
            {previewResults.length > 20 && (
              <div className="py-2 text-sm text-theme-muted">...and {previewResults.length - 20} more</div>
            )}
          </div>
        </div>
      )}

      {previewResults && previewResults.length === 0 && (
        <div className="card p-4 bg-theme-elevated">
          <p className="text-sm text-theme-muted">No transactions would be updated. All merchants already match aliases.</p>
          <button onClick={() => setPreviewResults(null)} className="mt-2 text-sm text-theme-muted hover:text-theme">Dismiss</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card p-4">
          <form onSubmit={handleSaveAlias} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme mb-1">Pattern to Match</label>
                <input
                  type="text"
                  value={aliasForm.pattern}
                  onChange={(e) => setAliasForm({ ...aliasForm, pattern: e.target.value })}
                  placeholder="e.g., AMZN MKTP"
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">Display As</label>
                <input
                  type="text"
                  value={aliasForm.canonical_name}
                  onChange={(e) => setAliasForm({ ...aliasForm, canonical_name: e.target.value })}
                  placeholder="e.g., Amazon"
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">Match Type</label>
                <select
                  value={aliasForm.match_type}
                  onChange={(e) => setAliasForm({ ...aliasForm, match_type: e.target.value as 'exact' | 'contains' | 'regex' })}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                >
                  <option value="contains">Contains</option>
                  <option value="exact">Exact Match</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">Priority</label>
                <input
                  type="number"
                  value={aliasForm.priority}
                  onChange={(e) => setAliasForm({ ...aliasForm, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                />
                <p className="text-xs text-theme-muted mt-1">Higher = checked first</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-theme rounded-md">Cancel</button>
              <button type="submit" className="btn-primary">{editingAlias ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Aliases */}
        <div className="card">
          <div className="p-4 border-b border-theme">
            <h3 className="font-semibold text-theme">Aliases ({aliases.length})</h3>
          </div>
          {aliases.length === 0 ? (
            <div className="p-8 text-center text-theme-muted text-sm">No aliases yet</div>
          ) : (
            <div className="divide-y divide-theme max-h-[400px] overflow-y-auto">
              {aliases.map((alias) => (
                <div key={alias.id} className="p-3 hover:bg-theme-elevated">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate">{alias.pattern}</span>
                        <span className="text-theme-muted">→</span>
                        <span className="font-medium text-theme truncate">{alias.canonical_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-theme-muted">
                        <span className={`px-1.5 py-0.5 rounded ${
                          alias.match_type === 'contains' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          alias.match_type === 'exact' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>{alias.match_type}</span>
                        <span>Used {alias.match_count}x</span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => {
                          setAliasForm({ pattern: alias.pattern, canonical_name: alias.canonical_name, match_type: alias.match_type, priority: alias.priority })
                          setEditingAlias(alias)
                          setShowForm(true)
                        }}
                        className="px-2 py-1 text-xs text-theme-muted hover:text-theme"
                      >Edit</button>
                      <button onClick={() => handleDeleteAlias(alias.id)} className="px-2 py-1 text-xs text-red-500 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Merchants */}
        <div className="card">
          <div className="p-4 border-b border-theme">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-theme">All Merchants ({merchants.length})</h3>
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter merchants..."
              className="mt-2 w-full px-3 py-1.5 text-sm bg-theme border border-theme rounded-md"
            />
          </div>
          <div className="divide-y divide-theme max-h-[400px] overflow-y-auto">
            {filteredMerchants.map((merchant, idx) => (
              <div
                key={idx}
                className="p-3 flex items-center justify-between hover:bg-theme-elevated cursor-pointer"
                onClick={() => startCreateFromMerchant(merchant.name)}
              >
                <span className="font-mono text-sm truncate flex-1">{merchant.name}</span>
                <span className="text-xs text-theme-muted ml-2">{merchant.transaction_count} txns</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function FormatsContent() {
  const [formats, setFormats] = useState<SavedFormatConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingFormat, setEditingFormat] = useState<SavedFormatConfig | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [testFile, setTestFile] = useState<File | null>(null)
  const [testingFormatId, setTestingFormatId] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<{ transactions: any[], errors: string[] } | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFormats()
  }, [])

  async function fetchFormats() {
    try {
      const res = await fetch('/api/v1/import/custom/configs')
      if (res.ok) {
        const data = await res.json()
        setFormats(data)
      }
    } catch (error) {
      console.error('Error fetching formats:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this format configuration?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/v1/import/custom/configs/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchFormats()
      }
    } catch (error) {
      console.error('Error deleting format:', error)
    } finally {
      setDeleting(null)
    }
  }

  function handleTestClick(format: SavedFormatConfig) {
    setTestingFormatId(format.id)
    setTestResults(null)
    fileInputRef.current?.click()
  }

  async function handleTestFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !testingFormatId) return

    setTestFile(file)
    const format = formats.find(f => f.id === testingFormatId)
    if (!format) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('config_json', format.config_json)

      const res = await fetch('/api/v1/import/custom/preview', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      setTestResults({
        transactions: data.transactions || [],
        errors: data.errors || []
      })
    } catch (error) {
      console.error('Error testing format:', error)
      setTestResults({ transactions: [], errors: ['Failed to test format'] })
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function parseConfigSummary(configJson: string): string {
    try {
      const config = JSON.parse(configJson)
      const parts = []
      if (config.account_source) parts.push(`Account: ${config.account_source}`)
      if (config.date_column) parts.push(`Date: ${config.date_column}`)
      if (config.amount_column) parts.push(`Amount: ${config.amount_column}`)
      return parts.join(' • ')
    } catch {
      return 'Invalid configuration'
    }
  }

  function handleEdit(format: SavedFormatConfig) {
    setEditingFormat(format)
    setSelectedFile(null)
    setMode('edit')
  }

  function handleCreate() {
    setEditingFormat(null)
    setSelectedFile(null)
    setSaveError(null)
    // Trigger file picker
    createFileInputRef.current?.click()
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setMode(editingFormat ? 'edit' : 'create')
    }
    // Reset file input
    if (createFileInputRef.current) {
      createFileInputRef.current.value = ''
    }
  }

  function handleBackToList() {
    setMode('list')
    setSelectedFile(null)
    setEditingFormat(null)
    setSaveError(null)
    fetchFormats()
  }

  async function handleConfigured(config: any) {
    setSaving(true)
    setSaveError(null)

    try {
      const body = {
        name: config.name,
        description: config.description || '',
        config_json: JSON.stringify(config)
      }

      const url = editingFormat
        ? `/api/v1/import/custom/configs/${editingFormat.id}`
        : '/api/v1/import/custom/configs'
      const method = editingFormat ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to save format')
      }

      handleBackToList()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save format')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-theme-muted">Loading...</div>

  // If creating/editing, show the format mapper inline
  if ((mode === 'create' || mode === 'edit') && selectedFile) {
    const initialConfig = editingFormat ? (() => {
      try {
        const parsed = JSON.parse(editingFormat.config_json)
        return { ...parsed, description: editingFormat.description }
      } catch {
        return undefined
      }
    })() : undefined

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
          >
            ← Back to Formats
          </button>
          <h2 className="text-xl font-semibold text-theme">
            {editingFormat ? 'Edit Format Configuration' : 'Create New Format'}
          </h2>
          <span className="text-sm text-theme-muted">({selectedFile.name})</span>
        </div>

        {saveError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            {saveError}
          </div>
        )}

        {/* Format Mapper inline */}
        <CustomFormatMapper
          file={selectedFile}
          onConfigured={handleConfigured}
          onCancel={handleBackToList}
          initialConfig={initialConfig}
        />
      </div>
    )
  }

  // If edit mode but no file selected yet, show file picker
  if (mode === 'edit' && editingFormat && !selectedFile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
          >
            ← Back to Formats
          </button>
          <h2 className="text-xl font-semibold text-theme">
            Edit Format: {editingFormat.name}
          </h2>
        </div>

        <div className="card p-8 text-center">
          <p className="text-theme-muted mb-6">
            Upload a sample CSV file to edit the format configuration.
            This helps verify your column mappings are correct.
          </p>
          <input
            ref={createFileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            onClick={() => createFileInputRef.current?.click()}
            className="btn-primary"
          >
            Select CSV File
          </button>
        </div>
      </div>
    )
  }

  // List view (default)
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">
          Create reusable import configurations for different bank CSV formats
        </p>
        <button onClick={handleCreate} className="btn-primary text-sm">
          + New Format
        </button>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleTestFile}
        className="hidden"
      />
      <input
        ref={createFileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Test Results */}
      {testResults && (
        <div className="card p-4 border-2 border-blue-500">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-theme">
              Test Results: {testResults.transactions.length} transactions parsed
              {testFile && <span className="text-sm font-normal text-theme-muted ml-2">from {testFile.name}</span>}
            </h3>
            <button
              onClick={() => { setTestResults(null); setTestFile(null); setTestingFormatId(null) }}
              className="text-theme-muted hover:text-theme"
            >
              ✕
            </button>
          </div>
          {testResults.errors.length > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-300">
              {testResults.errors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}
          {testResults.transactions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-theme-elevated">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Merchant</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.transactions.slice(0, 5).map((txn, i) => (
                    <tr key={i} className="border-t border-theme">
                      <td className="px-3 py-2">{txn.date}</td>
                      <td className="px-3 py-2">{txn.merchant}</td>
                      <td className="px-3 py-2 truncate max-w-[200px]">{txn.description}</td>
                      <td className={`px-3 py-2 text-right ${txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                        {formatCurrency(txn.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {testResults.transactions.length > 5 && (
                <div className="px-3 py-2 text-sm text-theme-muted">
                  Showing 5 of {testResults.transactions.length} transactions
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formats List */}
      <div className="card">
        {formats.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-theme-muted mb-4">No custom CSV formats created yet.</p>
            <p className="text-sm text-theme-muted">
              Create a format configuration to reuse when importing CSV files from your banks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-theme">
            {formats.map((fmt) => (
              <div key={fmt.id} className="p-4 hover:bg-theme-elevated">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-theme">{fmt.name}</h3>
                      {fmt.use_count > 0 && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded dark:bg-green-900/30 dark:text-green-300">
                          Used {fmt.use_count}x
                        </span>
                      )}
                    </div>
                    {fmt.description && (
                      <p className="text-sm text-theme-muted mb-2">{fmt.description}</p>
                    )}
                    <p className="text-xs text-theme-muted">{parseConfigSummary(fmt.config_json)}</p>
                    <p className="text-xs text-theme-muted mt-1">
                      Created {format(new Date(fmt.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleTestClick(fmt)}
                      className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleEdit(fmt)}
                      className="px-3 py-1.5 text-sm text-theme-muted hover:text-theme border border-theme rounded-md hover:bg-theme-elevated"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(fmt.id)}
                      disabled={deleting === fmt.id}
                      className="px-3 py-1.5 text-sm text-red-500 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      {deleting === fmt.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// FormatMapperWrapper removed - now using inline format mapper
