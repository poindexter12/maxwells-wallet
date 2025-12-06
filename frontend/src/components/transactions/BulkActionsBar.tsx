'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag, Transaction } from '@/types/transactions'

interface BulkActionsBarProps {
  selectedIds: Set<number>
  transactions: Transaction[]
  totalCount: number
  bucketTags: Tag[]
  occasionTags: Tag[]
  accountTags: Tag[]
  onToggleAll: () => void
  onClearSelection: () => void
  onApplyTag: (tagFull: string, ids: number[]) => Promise<void>
}

export default function BulkActionsBar({
  selectedIds,
  transactions,
  totalCount,
  bucketTags,
  occasionTags,
  accountTags,
  onToggleAll,
  onClearSelection,
  onApplyTag,
}: BulkActionsBarProps) {
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  const checkboxRef = useRef<HTMLInputElement>(null)

  // Handle indeterminate state for checkbox
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < transactions.length
    }
  }, [selectedIds.size, transactions.length])

  async function handleBulkApply() {
    if (!bulkAction || !bulkValue || selectedIds.size === 0) return

    setBulkLoading(true)
    try {
      await onApplyTag(bulkValue, Array.from(selectedIds))
      setBulkAction('')
      setBulkValue('')
    } catch (error) {
      console.error('Error applying bulk action:', error)
    } finally {
      setBulkLoading(false)
    }
  }

  function handleClear() {
    onClearSelection()
    setBulkAction('')
    setBulkValue('')
  }

  return (
    <div
      className={`rounded-lg shadow p-4 transition-all duration-200 ${
        selectedIds.size > 0
          ? 'bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]/30 sticky top-0 z-10'
          : 'card'
      }`}
      data-testid="bulk-actions-bar"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={selectedIds.size === transactions.length && transactions.length > 0}
            onChange={onToggleAll}
            className="w-4 h-4 rounded"
            data-testid="select-all-checkbox"
          />
          <span className={`text-sm font-medium ${selectedIds.size > 0 ? 'text-[var(--color-accent)]' : 'text-theme-muted'}`}>
            {selectedIds.size > 0
              ? `${selectedIds.size} of ${totalCount.toLocaleString()} selected`
              : `Select all (${transactions.length} loaded)`}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <>
            <div className="h-6 w-px bg-[var(--color-accent)]/30" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-accent)]">Assign:</span>
              <select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value)
                  setBulkValue('')
                }}
                className="px-3 py-1.5 border border-[var(--color-accent)]/30 rounded-md text-sm bg-theme-elevated focus:ring-2 focus:ring-[var(--color-accent)]"
                data-testid="bulk-action-type"
              >
                <option value="">Choose type...</option>
                <option value="bucket">Bucket</option>
                <option value="occasion">Occasion</option>
                <option value="account">Account</option>
              </select>

              {bulkAction === 'bucket' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-accent)]/30 rounded-md text-sm bg-theme-elevated focus:ring-2 focus:ring-[var(--color-accent)]"
                  data-testid="bulk-bucket-select"
                >
                  <option value="">Select bucket...</option>
                  {bucketTags.map((tag) => (
                    <option key={tag.id} value={`bucket:${tag.value}`}>
                      {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === 'occasion' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-accent)]/30 rounded-md text-sm bg-theme-elevated focus:ring-2 focus:ring-[var(--color-accent)]"
                  data-testid="bulk-occasion-select"
                >
                  <option value="">Select occasion...</option>
                  {occasionTags.map((tag) => (
                    <option key={tag.id} value={`occasion:${tag.value}`}>
                      {tag.value.charAt(0).toUpperCase() + tag.value.slice(1).replace(/-/g, ' ')}
                    </option>
                  ))}
                </select>
              )}

              {bulkAction === 'account' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-accent)]/30 rounded-md text-sm bg-theme-elevated focus:ring-2 focus:ring-[var(--color-accent)]"
                  data-testid="bulk-account-select"
                >
                  <option value="">Select account...</option>
                  {accountTags.map((tag) => (
                    <option key={tag.id} value={`account:${tag.value}`}>
                      {tag.description || tag.value}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {bulkValue && (
              <button
                onClick={handleBulkApply}
                disabled={bulkLoading}
                className="btn-primary text-sm disabled:opacity-50"
                data-testid="bulk-apply-btn"
              >
                {bulkLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Applying...
                  </span>
                ) : (
                  `Apply to ${selectedIds.size}`
                )}
              </button>
            )}

            <button
              onClick={handleClear}
              className="ml-auto text-sm text-[var(--color-accent)] hover:opacity-80 font-medium"
              data-testid="clear-selection-btn"
            >
              Clear selection
            </button>
          </>
        )}
      </div>
    </div>
  )
}
