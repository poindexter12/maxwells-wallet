'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

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

interface AliasFormData {
  pattern: string
  canonical_name: string
  match_type: 'exact' | 'contains' | 'regex'
  priority: number
}

const initialAliasForm: AliasFormData = {
  pattern: '',
  canonical_name: '',
  match_type: 'contains',
  priority: 0
}

export default function MerchantsPanel() {
  const t = useTranslations('tools.merchants')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [aliases, setAliases] = useState<MerchantAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAlias, setEditingAlias] = useState<MerchantAlias | null>(null)
  const [aliasForm, setAliasForm] = useState<AliasFormData>(initialAliasForm)
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
    setAliasForm(initialAliasForm)
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
    if (!confirm(t('confirmDelete'))) return
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
    if (!confirm(t('confirmApply', { count: previewResults?.length || 0 }))) return
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
    setAliasForm({
      pattern: merchantName,
      canonical_name: merchantName,
      match_type: 'contains',
      priority: 0
    })
    setEditingAlias(null)
    setShowForm(true)
  }

  function startEditAlias(alias: MerchantAlias) {
    setAliasForm({
      pattern: alias.pattern,
      canonical_name: alias.canonical_name,
      match_type: alias.match_type,
      priority: alias.priority
    })
    setEditingAlias(alias)
    setShowForm(true)
  }

  const filteredMerchants = merchants.filter(m =>
    m.name.toLowerCase().includes(searchFilter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="text-center py-12 text-theme-muted" data-testid="merchants-loading">
        {tCommon('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="merchants-panel">
      <div className="flex justify-between items-center">
        <p className="text-sm text-theme-muted">
          {t('description')}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={applying || aliases.length === 0}
            className="px-3 py-1.5 text-sm border border-theme rounded-md hover:bg-theme-elevated disabled:opacity-50"
            data-testid="preview-btn"
          >
            {applying ? t('checking') : t('previewChanges')}
          </button>
          <button
            onClick={() => { setEditingAlias(null); resetForm(); setShowForm(true) }}
            className="btn-primary text-sm"
            data-testid="new-alias-btn"
          >
            + {t('newAlias')}
          </button>
        </div>
      </div>

      {/* Preview Results */}
      {previewResults && previewResults.length > 0 && (
        <div className="card p-4 border-2 border-blue-500" data-testid="preview-results">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-theme">
              {t('previewResult', { count: previewResults.length })}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setPreviewResults(null)}
                className="px-3 py-1 text-sm border border-theme rounded"
                data-testid="dismiss-preview-btn"
              >
                {t('dismiss')}
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="btn-primary text-sm disabled:opacity-50"
                data-testid="apply-changes-btn"
              >
                {applying ? t('applying') : t('applyChanges')}
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-theme">
            {previewResults.slice(0, 20).map((u, i) => (
              <div key={i} className="py-2 text-sm">
                <span className="text-theme-muted">{u.old_merchant || t('none')}</span>
                <span className="mx-2">→</span>
                <span className="text-theme font-medium">{u.new_merchant}</span>
                <span className="ml-2 text-xs text-theme-muted">({u.matched_pattern})</span>
              </div>
            ))}
            {previewResults.length > 20 && (
              <div className="py-2 text-sm text-theme-muted">
                ...and {previewResults.length - 20} more
              </div>
            )}
          </div>
        </div>
      )}

      {previewResults && previewResults.length === 0 && (
        <div className="card p-4 bg-theme-elevated" data-testid="no-preview-changes">
          <p className="text-sm text-theme-muted">
            {t('noChanges')}
          </p>
          <button
            onClick={() => setPreviewResults(null)}
            className="mt-2 text-sm text-theme-muted hover:text-theme"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card p-4" data-testid="alias-form">
          <form onSubmit={handleSaveAlias} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme mb-1">{t('patternToMatch')}</label>
                <input
                  type="text"
                  value={aliasForm.pattern}
                  onChange={(e) => setAliasForm({ ...aliasForm, pattern: e.target.value })}
                  placeholder={t('patternPlaceholder')}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  required
                  data-testid="alias-pattern-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">{t('displayAs')}</label>
                <input
                  type="text"
                  value={aliasForm.canonical_name}
                  onChange={(e) => setAliasForm({ ...aliasForm, canonical_name: e.target.value })}
                  placeholder={t('displayAsPlaceholder')}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  required
                  data-testid="alias-canonical-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">{t('matchType')}</label>
                <select
                  value={aliasForm.match_type}
                  onChange={(e) => setAliasForm({ ...aliasForm, match_type: e.target.value as 'exact' | 'contains' | 'regex' })}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  data-testid="alias-match-type-select"
                >
                  <option value="contains">{t('contains')}</option>
                  <option value="exact">{t('exactMatch')}</option>
                  <option value="regex">{t('regex')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">{tFields('priority')}</label>
                <input
                  type="number"
                  value={aliasForm.priority}
                  onChange={(e) => setAliasForm({ ...aliasForm, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-theme border border-theme rounded-md"
                  data-testid="alias-priority-input"
                />
                <p className="text-xs text-theme-muted mt-1">{t('higherCheckedFirst')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-theme rounded-md"
                data-testid="alias-cancel-btn"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary"
                data-testid="alias-submit-btn"
              >
                {editingAlias ? tCommon('update') : tCommon('create')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Aliases */}
        <div className="card" data-testid="aliases-list">
          <div className="p-4 border-b border-theme">
            <h3 className="font-semibold text-theme">{t('aliases')} ({aliases.length})</h3>
          </div>
          {aliases.length === 0 ? (
            <div className="p-8 text-center text-theme-muted text-sm" data-testid="no-aliases">
              {t('noAliases')}
            </div>
          ) : (
            <div className="divide-y divide-theme max-h-[400px] overflow-y-auto">
              {aliases.map((alias) => (
                <div
                  key={alias.id}
                  className="p-3 hover:bg-theme-elevated"
                  data-testid={`alias-row-${alias.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate">{alias.pattern}</span>
                        <span className="text-theme-muted">→</span>
                        <span className="font-medium text-theme truncate">{alias.canonical_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-theme-muted">
                        <span className={`px-1.5 py-0.5 rounded ${
                          alias.match_type === 'contains'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : alias.match_type === 'exact'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {alias.match_type}
                        </span>
                        <span>{t('used')} {alias.match_count}x</span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => startEditAlias(alias)}
                        className="px-2 py-1 text-xs text-theme-muted hover:text-theme"
                        data-testid={`edit-alias-${alias.id}`}
                      >
                        {tCommon('edit')}
                      </button>
                      <button
                        onClick={() => handleDeleteAlias(alias.id)}
                        className="px-2 py-1 text-xs text-red-500 hover:text-red-700"
                        data-testid={`delete-alias-${alias.id}`}
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

        {/* All Merchants */}
        <div className="card" data-testid="merchants-list">
          <div className="p-4 border-b border-theme">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-theme">{t('allMerchants')} ({merchants.length})</h3>
            </div>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={t('filterMerchants')}
              className="mt-2 w-full px-3 py-1.5 text-sm bg-theme border border-theme rounded-md"
              data-testid="merchant-search-input"
            />
          </div>
          <div className="divide-y divide-theme max-h-[400px] overflow-y-auto">
            {filteredMerchants.map((merchant, idx) => (
              <div
                key={idx}
                className="p-3 flex items-center justify-between hover:bg-theme-elevated cursor-pointer"
                onClick={() => startCreateFromMerchant(merchant.name)}
                data-testid={`merchant-row-${idx}`}
              >
                <span className="font-mono text-sm truncate flex-1">{merchant.name}</span>
                <span className="text-xs text-theme-muted ml-2">{merchant.transaction_count} {t('txns')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
