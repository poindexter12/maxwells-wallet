'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format'

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface SplitItem {
  tag: string
  amount: number
}

interface SplitResponse {
  transaction_id: number
  total_amount: number
  splits: SplitItem[]
  unallocated: number
}

interface SplitTransactionProps {
  transactionId: number
  transactionAmount: number
  bucketTags: Tag[]
  onSplitsChanged?: () => void
}

export function SplitTransaction({
  transactionId,
  transactionAmount,
  bucketTags,
  onSplitsChanged
}: SplitTransactionProps) {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const [splits, setSplits] = useState<SplitItem[]>([])
  const [totalAmount, setTotalAmount] = useState(Math.abs(transactionAmount))
  const [unallocated, setUnallocated] = useState(Math.abs(transactionAmount))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New split being added
  const [newBucket, setNewBucket] = useState('')
  const [newAmount, setNewAmount] = useState('')

  // Fetch current splits
  useEffect(() => {
    fetchSplits()
  }, [transactionId])

  async function fetchSplits() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/transactions/${transactionId}/splits`)
      if (!res.ok) throw new Error('Failed to load splits')
      const data: SplitResponse = await res.json()
      setSplits(data.splits)
      setTotalAmount(data.total_amount)
      setUnallocated(data.unallocated)
    } catch (err) {
      setError('Failed to load splits')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function saveSplits(newSplits: SplitItem[]) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/transactions/${transactionId}/splits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splits: newSplits })
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Failed to save splits')
      }
      const data: SplitResponse = await res.json()
      setSplits(data.splits)
      setUnallocated(data.unallocated)
      onSplitsChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save splits')
    } finally {
      setSaving(false)
    }
  }

  function handleAddSplit() {
    if (!newBucket || !newAmount) return

    const amount = parseFloat(newAmount)
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive amount')
      return
    }

    const tag = `bucket:${newBucket}`
    // Check if this bucket already has a split
    const existingIndex = splits.findIndex(s => s.tag === tag)

    let newSplits: SplitItem[]
    if (existingIndex >= 0) {
      // Update existing split
      newSplits = [...splits]
      newSplits[existingIndex] = { tag, amount }
    } else {
      // Add new split
      newSplits = [...splits, { tag, amount }]
    }

    saveSplits(newSplits)
    setNewBucket('')
    setNewAmount('')
  }

  function handleRemoveSplit(index: number) {
    const newSplits = splits.filter((_, i) => i !== index)
    saveSplits(newSplits)
  }

  function handleClearAll() {
    saveSplits([])
  }

  // Quick split: allocate remaining to a bucket
  function handleQuickAllocate(bucket: string) {
    if (unallocated <= 0) return

    const tag = `bucket:${bucket}`
    const existingIndex = splits.findIndex(s => s.tag === tag)

    let newSplits: SplitItem[]
    if (existingIndex >= 0) {
      newSplits = [...splits]
      newSplits[existingIndex] = {
        tag,
        amount: newSplits[existingIndex].amount + unallocated
      }
    } else {
      newSplits = [...splits, { tag, amount: unallocated }]
    }

    saveSplits(newSplits)
  }

  // Calculate allocated total
  const allocatedTotal = splits.reduce((sum, s) => sum + s.amount, 0)
  const percentAllocated = totalAmount > 0 ? (allocatedTotal / totalAmount) * 100 : 0

  if (loading) {
    return (
      <div className="py-2 text-sm text-theme-muted" data-testid="split-loading">
        {tCommon('loading')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-theme">Split Transaction</h4>
        {splits.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={saving}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {tCommon('clear')} all
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
          {error}
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-theme-muted">
            {formatCurrency(allocatedTotal, true)} of {formatCurrency(totalAmount, true)} allocated
          </span>
          <span className={`font-medium ${percentAllocated > 100 ? 'text-orange-500' : percentAllocated === 100 ? 'text-green-500' : 'text-theme-muted'}`}>
            {percentAllocated.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              percentAllocated > 100 ? 'bg-orange-400' :
              percentAllocated === 100 ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, percentAllocated)}%` }}
          />
        </div>
        {unallocated > 0 && (
          <div className="text-xs text-theme-muted">
            {formatCurrency(unallocated, true)} unallocated
          </div>
        )}
      </div>

      {/* Current splits */}
      {splits.length > 0 && (
        <div className="space-y-1">
          {splits.map((split, index) => {
            const bucketValue = split.tag.replace('bucket:', '')
            const bucketTag = bucketTags.find(t => t.value === bucketValue)
            const displayName = bucketTag?.description ||
              bucketValue.charAt(0).toUpperCase() + bucketValue.slice(1)
            const percent = totalAmount > 0 ? (split.amount / totalAmount) * 100 : 0

            return (
              <div
                key={split.tag}
                className="flex items-center justify-between px-2 py-1.5 bg-theme-subtle rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-theme font-medium">{displayName}</span>
                  <span className="text-xs text-theme-muted">({percent.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-theme">
                    {formatCurrency(split.amount, true)}
                  </span>
                  <button
                    onClick={() => handleRemoveSplit(index)}
                    disabled={saving}
                    className="text-theme-muted hover:text-red-500 disabled:opacity-50"
                    title={tCommon('remove')}
                    data-testid="split-remove-button"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add new split */}
      <div className="flex items-center gap-2">
        <select
          value={newBucket}
          onChange={(e) => setNewBucket(e.target.value)}
          className="flex-1 h-8 text-sm border border-theme rounded px-2 bg-theme-elevated"
          disabled={saving}
          data-testid="split-bucket-select"
        >
          <option value="" data-testid="split-bucket-placeholder">{tCommon('search')} {t('bucket').toLowerCase()}...</option>
          {bucketTags.map((tag) => (
            <option key={tag.id} value={tag.value}>
              {tag.description || tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
            </option>
          ))}
        </select>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-muted text-sm">$</span>
          <input
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-24 h-8 text-sm border border-theme rounded pl-5 pr-2 bg-theme-elevated"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSplit()
            }}
          />
        </div>
        <button
          onClick={handleAddSplit}
          disabled={saving || !newBucket || !newAmount}
          className="h-8 px-3 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '...' : tCommon('add')}
        </button>
      </div>

      {/* Quick allocate buttons */}
      {unallocated > 0 && (
        <div className="pt-2 border-t border-theme">
          <div className="text-xs text-theme-muted mb-2">
            Quick: Allocate remaining {formatCurrency(unallocated, true)} to:
          </div>
          <div className="flex flex-wrap gap-1">
            {bucketTags.slice(0, 6).map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleQuickAllocate(tag.value)}
                disabled={saving}
                className="px-2 py-1 text-xs rounded border border-theme hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
              >
                {tag.description || tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
