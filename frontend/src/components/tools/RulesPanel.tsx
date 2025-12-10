'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

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

interface RuleFormData {
  name: string
  tag: string
  priority: string
  enabled: boolean
  merchant_pattern: string
  description_pattern: string
  amount_min: string
  amount_max: string
  account_source: string
  match_all: boolean
}

const initialFormData: RuleFormData = {
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
}

export default function RulesPanel() {
  const t = useTranslations('tools.rules')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const [rules, setRules] = useState<TagRule[]>([])
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<TagRule | null>(null)
  const [testResults, setTestResults] = useState<{ ruleId: number; match_count: number } | null>(null)
  const [formData, setFormData] = useState<RuleFormData>(initialFormData)

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
    const payload: Record<string, unknown> = {
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
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('confirmDelete'))) return
    await fetch(`/api/v1/tag-rules/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  async function handleToggleEnabled(rule: TagRule) {
    await fetch(`/api/v1/tag-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled })
    })
    fetchRules()
  }

  async function handleTestRule(ruleId: number) {
    const res = await fetch(`/api/v1/tag-rules/${ruleId}/test`, { method: 'POST' })
    setTestResults({ ruleId, ...(await res.json()) })
  }

  async function handleApplyRules() {
    if (!confirm(t('confirmApplyAll'))) return
    const res = await fetch('/api/v1/tag-rules/apply', { method: 'POST' })
    const data = await res.json()
    alert(t('rulesApplied', { count: data.applied_count }))
    fetchRules()
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
    setFormData(initialFormData)
  }

  function getRuleConditions(rule: TagRule): string[] {
    const conditions = []
    if (rule.merchant_pattern) conditions.push(`${tFields('merchant')}: "${rule.merchant_pattern}"`)
    if (rule.description_pattern) conditions.push(`${tFields('description')}: "${rule.description_pattern}"`)
    if (rule.amount_min || rule.amount_max) {
      conditions.push(`${tFields('amount')}: ${rule.amount_min || 'any'} - ${rule.amount_max || 'any'}`)
    }
    if (rule.account_source) conditions.push(`${tFields('account')}: "${rule.account_source}"`)
    return conditions
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-theme-muted" data-testid="rules-loading">
        {tCommon('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="rules-panel">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">
          {t('description')}
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleApplyRules}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            data-testid="apply-rules-btn"
          >
            {t('applyAllRules')}
          </button>
          <button
            onClick={() => { setEditingRule(null); resetForm(); setShowForm(true) }}
            className="btn-primary text-sm"
            data-testid="new-rule-btn"
          >
            {t('newRule')}
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div className="card" data-testid="rules-list">
        {rules.length === 0 ? (
          <p className="text-theme-muted text-center py-12" data-testid="no-rules">
            {t('noRules')}
          </p>
        ) : (
          <div className="divide-y divide-theme">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4" data-testid={`rule-row-${rule.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-theme">{rule.name}</h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded dark:bg-blue-900/30 dark:text-blue-300">
                        {rule.tag.split(':')[1] || rule.tag}
                      </span>
                      <span className="px-2 py-0.5 bg-theme-elevated text-xs rounded">
                        {t('priority')}: {rule.priority}
                      </span>
                      {!rule.enabled && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded dark:bg-red-900/30 dark:text-red-300">
                          {t('disabled')}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {getRuleConditions(rule).map((c, i) => (
                        <span key={i} className="text-xs bg-theme-elevated px-2 py-1 rounded">
                          {c}
                        </span>
                      ))}
                      <span className="text-xs text-theme-muted">
                        ({rule.match_all ? t('all') : t('any')})
                      </span>
                    </div>
                    <div className="text-xs text-theme-muted">
                      {t('matched')}: {rule.match_count} {t('transactions')}
                    </div>
                    {testResults?.ruleId === rule.id && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                        {t('testResult', { count: testResults.match_count })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggleEnabled(rule)}
                      className={`px-2 py-1 text-xs rounded ${
                        rule.enabled
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-theme-elevated'
                      }`}
                      data-testid={`toggle-enabled-${rule.id}`}
                    >
                      {rule.enabled ? t('enabled') : t('disabled')}
                    </button>
                    <button
                      onClick={() => handleTestRule(rule.id)}
                      className="text-theme-muted hover:text-theme text-sm"
                      data-testid={`test-rule-${rule.id}`}
                    >
                      {t('test')}
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="text-theme-muted hover:text-theme text-sm"
                      data-testid={`edit-rule-${rule.id}`}
                    >
                      {tCommon('edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                      data-testid={`delete-rule-${rule.id}`}
                    >
                      {tCommon('delete')}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" data-testid="rule-form-modal">
          <div className="card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-theme mb-4">
              {editingRule ? t('editRule') : t('createRule')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">{t('ruleName')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                    required
                    data-testid="rule-name-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">{t('targetBucket')} *</label>
                  <select
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                    required
                    data-testid="rule-tag-select"
                  >
                    <option value="">{t('select')}</option>
                    {bucketTags.map((tag) => (
                      <option key={tag.id} value={`bucket:${tag.value}`}>
                        {tag.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">{t('priority')}</label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  data-testid="rule-priority-input"
                />
              </div>
              <div className="border-t border-theme pt-4">
                <p className="text-sm font-medium text-theme mb-3">{t('matchingConditions')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-theme-muted mb-1">{t('merchantPattern')}</label>
                    <input
                      type="text"
                      value={formData.merchant_pattern}
                      onChange={(e) => setFormData({ ...formData, merchant_pattern: e.target.value })}
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                      placeholder="e.g., Starbucks"
                      data-testid="rule-merchant-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-theme-muted mb-1">{t('descriptionPattern')}</label>
                    <input
                      type="text"
                      value={formData.description_pattern}
                      onChange={(e) => setFormData({ ...formData, description_pattern: e.target.value })}
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                      placeholder="e.g., Coffee"
                      data-testid="rule-description-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-theme-muted mb-1">{t('amountMin')}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount_min}
                        onChange={(e) => setFormData({ ...formData, amount_min: e.target.value })}
                        className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                        data-testid="rule-amount-min-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-theme-muted mb-1">{t('amountMax')}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount_max}
                        onChange={(e) => setFormData({ ...formData, amount_max: e.target.value })}
                        className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                        data-testid="rule-amount-max-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-theme-muted mb-1">{t('accountSource')}</label>
                    <input
                      type="text"
                      value={formData.account_source}
                      onChange={(e) => setFormData({ ...formData, account_source: e.target.value })}
                      className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                      data-testid="rule-account-input"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2 border-t border-theme pt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.match_all}
                    onChange={(e) => setFormData({ ...formData, match_all: e.target.checked })}
                    data-testid="rule-match-all-checkbox"
                  />
                  {t('matchAll')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    data-testid="rule-enabled-checkbox"
                  />
                  {t('enableImmediately')}
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingRule(null) }}
                  className="flex-1 px-4 py-2 border border-theme rounded-md hover:bg-theme-elevated"
                  data-testid="rule-cancel-btn"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  data-testid="rule-submit-btn"
                >
                  {editingRule ? tCommon('update') : tCommon('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
