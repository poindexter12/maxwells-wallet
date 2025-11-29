'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface TagRule {
  id: number
  name: string
  tag: string  // format: namespace:value
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
  created_at: string
}

export default function TagRulesPage() {
  const [rules, setRules] = useState<TagRule[]>([])
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<TagRule | null>(null)
  const [testResults, setTestResults] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    priority: '0',
    enabled: true,
    merchant_pattern: '',
    description_pattern: '',
    amount_min: '',
    amount_max: '',
    account_source: '',
    match_all: false
  })

  useEffect(() => {
    fetchBucketTags()
    fetchRules()
  }, [])

  async function fetchBucketTags() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      const data = await res.json()
      setBucketTags(data)
    } catch (error) {
      console.error('Error fetching bucket tags:', error)
    }
  }

  async function fetchRules() {
    try {
      const res = await fetch('/api/v1/tag-rules')
      const data = await res.json()
      setRules(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching rules:', error)
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload: any = {
      name: formData.name,
      tag: formData.tag,
      priority: parseInt(formData.priority),
      enabled: formData.enabled,
      match_all: formData.match_all
    }

    if (formData.merchant_pattern) payload.merchant_pattern = formData.merchant_pattern
    if (formData.description_pattern) payload.description_pattern = formData.description_pattern
    if (formData.amount_min) payload.amount_min = parseFloat(formData.amount_min)
    if (formData.amount_max) payload.amount_max = parseFloat(formData.amount_max)
    if (formData.account_source) payload.account_source = formData.account_source

    try {
      if (editingRule) {
        await fetch(`/api/v1/tag-rules/${editingRule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch('/api/v1/tag-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      setShowForm(false)
      setEditingRule(null)
      resetForm()
      fetchRules()
    } catch (error) {
      console.error('Error saving rule:', error)
      alert('Error saving rule. Please ensure at least one matching condition is specified.')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      await fetch(`/api/v1/tag-rules/${id}`, { method: 'DELETE' })
      fetchRules()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  async function handleToggleEnabled(rule: TagRule) {
    try {
      await fetch(`/api/v1/tag-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled })
      })
      fetchRules()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  async function handleTestRule(ruleId: number) {
    try {
      const res = await fetch(`/api/v1/tag-rules/${ruleId}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResults({ ruleId, ...data })
    } catch (error) {
      console.error('Error testing rule:', error)
    }
  }

  async function handleApplyRules() {
    if (!confirm('Apply all active rules to untagged transactions?')) return

    try {
      const res = await fetch('/api/v1/tag-rules/apply', { method: 'POST' })
      const data = await res.json()
      alert(`Applied rules to ${data.applied_count} transactions`)
      fetchRules()
    } catch (error) {
      console.error('Error applying rules:', error)
    }
  }

  function handleEdit(rule: TagRule) {
    setEditingRule(rule)
    setFormData({
      name: rule.name,
      tag: rule.tag,
      priority: rule.priority.toString(),
      enabled: rule.enabled,
      merchant_pattern: rule.merchant_pattern || '',
      description_pattern: rule.description_pattern || '',
      amount_min: rule.amount_min?.toString() || '',
      amount_max: rule.amount_max?.toString() || '',
      account_source: rule.account_source || '',
      match_all: rule.match_all
    })
    setShowForm(true)
  }

  function resetForm() {
    setFormData({
      name: '',
      tag: '',
      priority: '0',
      enabled: true,
      merchant_pattern: '',
      description_pattern: '',
      amount_min: '',
      amount_max: '',
      account_source: '',
      match_all: false
    })
  }

  function getRuleConditions(rule: TagRule): string[] {
    const conditions = []
    if (rule.merchant_pattern) conditions.push(`Merchant: "${rule.merchant_pattern}"`)
    if (rule.description_pattern) conditions.push(`Description: "${rule.description_pattern}"`)
    if (rule.amount_min || rule.amount_max) {
      const min = rule.amount_min ? `$${rule.amount_min}` : 'any'
      const max = rule.amount_max ? `$${rule.amount_max}` : 'any'
      conditions.push(`Amount: ${min} - ${max}`)
    }
    if (rule.account_source) conditions.push(`Account: "${rule.account_source}"`)
    return conditions
  }

  function formatTagDisplay(tag: string): string {
    // Convert "bucket:groceries" to "Groceries"
    const parts = tag.split(':')
    if (parts.length === 2 && parts[0] === 'bucket') {
      return parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
    }
    return tag
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="rules"
        title="Rules Help"
        description="Create rules to automatically categorize transactions based on merchant names, descriptions, or amounts. Rules run on import and can be applied to existing transactions."
        steps={[
          "Click 'New Rule' to create an auto-categorization rule",
          "Set patterns to match (merchant name, description text, amount range)",
          "Choose the bucket to assign when the pattern matches",
          "Use 'Test Rule' to preview which transactions would match",
          "Click 'Apply All Rules' to run rules on uncategorized transactions"
        ]}
        tips={[
          "Higher priority rules are checked first (useful for specific overrides)",
          "Use 'Match All' to require all conditions (AND logic), otherwise any match works (OR logic)",
          "Patterns are case-insensitive substring matches"
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Bucket Rules</h1>
          <p className="mt-2 text-sm text-theme-muted">
            Automatically assign buckets to transactions based on patterns
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleApplyRules}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Apply All Rules
          </button>
          <button
            onClick={() => {
              setEditingRule(null)
              resetForm()
              setShowForm(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            New Rule
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div className="bg-white rounded-lg shadow">
        {rules.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No rules created yet</p>
        ) : (
          <div className="divide-y">
            {rules.map((rule) => (
              <div key={rule.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{rule.name}</h3>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        {formatTagDisplay(rule.tag)}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                        Priority: {rule.priority}
                      </span>
                      {!rule.enabled && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                          Disabled
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Match logic:</span>{' '}
                        {rule.match_all ? 'ALL conditions must match' : 'ANY condition can match'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getRuleConditions(rule).map((condition, idx) => (
                          <span key={idx} className="text-sm bg-gray-50 px-2 py-1 rounded border">
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Matched: {rule.match_count} transactions</span>
                      {rule.last_matched_date && (
                        <span>Last match: {new Date(rule.last_matched_date).toLocaleDateString()}</span>
                      )}
                    </div>

                    {testResults && testResults.ruleId === rule.id && (
                      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-sm font-medium text-blue-900">
                          Test Results: {testResults.match_count} transactions would match this rule
                        </p>
                        {testResults.matches && testResults.matches.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {testResults.matches.slice(0, 3).map((txn: any, idx: number) => (
                              <p key={idx} className="text-xs text-blue-800">
                                {txn.date}: {txn.merchant || txn.description} - {formatCurrency(Math.abs(txn.amount))}
                              </p>
                            ))}
                            {testResults.matches.length > 3 && (
                              <p className="text-xs text-blue-600">... and {testResults.matches.length - 3} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggleEnabled(rule)}
                      className={`px-3 py-1 text-sm rounded ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleTestRule(rule.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
            <h2 className="text-xl font-semibold mb-4">
              {editingRule ? 'Edit Rule' : 'Create Rule'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Bucket *
                  </label>
                  <select
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  >
                    <option value="">Select a bucket...</option>
                    {bucketTags.map((tag) => (
                      <option key={tag.id} value={`bucket:${tag.value}`}>
                        {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority (higher = applied first)
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Matching Conditions (at least one required)
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Merchant Pattern
                    </label>
                    <input
                      type="text"
                      value={formData.merchant_pattern}
                      onChange={(e) => setFormData({ ...formData, merchant_pattern: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="e.g., Starbucks"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Description Pattern
                    </label>
                    <input
                      type="text"
                      value={formData.description_pattern}
                      onChange={(e) => setFormData({ ...formData, description_pattern: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="e.g., Coffee"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Amount Min
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount_min}
                        onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Amount Max
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount_max}
                        onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="999.99"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Account Source
                    </label>
                    <input
                      type="text"
                      value={formData.account_source}
                      onChange={(e) => setFormData({ ...formData, account_source: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="e.g., AMEX-53004"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.match_all}
                    onChange={(e) => setFormData({ ...formData, match_all: e.target.checked })}
                    className="mr-2"
                    id="match_all"
                  />
                  <label htmlFor="match_all" className="text-sm text-gray-700">
                    All conditions must match (AND logic) - default is ANY (OR logic)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="mr-2"
                    id="enabled"
                  />
                  <label htmlFor="enabled" className="text-sm text-gray-700">
                    Enable rule immediately
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingRule(null)
                  }}
                  className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingRule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
