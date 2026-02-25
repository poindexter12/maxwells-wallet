'use client'

import { useTranslations } from 'next-intl'
import { TEST_IDS } from '@/test-ids'

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface Transaction {
  id: number
  date: string
  amount: number
  description: string
  merchant: string | null
  account_source: string
  account_tag_id: number | null
  category: string | null
  reconciliation_status: string
  notes?: string | null
  tags?: Array<{
    namespace: string
    value: string
    full: string
  }>
  bucket?: string
  account?: string
  is_transfer?: boolean
  linked_transaction_id?: number | null
}

interface BulkActionsProps {
  selectedIds: Set<number>
  setSelectedIds: (ids: Set<number>) => void
  transactions: Transaction[]
  totalCount: number
  bucketTags: Tag[]
  occasionTags: Tag[]
  accountTags: Tag[]
  onBulkApply: () => Promise<void>
  bulkAction: string
  setBulkAction: (action: string) => void
  bulkValue: string
  setBulkValue: (value: string) => void
  bulkLoading: boolean
  onToggleSelectAll: () => void
}

export function BulkActions({
  selectedIds,
  setSelectedIds,
  transactions,
  totalCount,
  bucketTags,
  occasionTags,
  accountTags,
  onBulkApply,
  bulkAction,
  setBulkAction,
  bulkValue,
  setBulkValue,
  bulkLoading,
  onToggleSelectAll,
}: BulkActionsProps) {
  const t = useTranslations('transactions')

  return (
    <div className={`rounded-lg shadow p-4 transition-all duration-200 ${
      selectedIds.size > 0
        ? 'bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]/30 sticky top-0 z-10'
        : 'card'
    }`}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            data-testid={TEST_IDS.BULK_SELECT_ALL}
            type="checkbox"
            checked={selectedIds.size === transactions.length && transactions.length > 0}
            ref={el => {
              if (el) {
                el.indeterminate = selectedIds.size > 0 && selectedIds.size < transactions.length
              }
            }}
            onChange={onToggleSelectAll}
            className="w-4 h-4 rounded"
          />
          <span className={`text-sm font-medium ${selectedIds.size > 0 ? 'text-[var(--color-accent)]' : 'text-theme-muted'}`}>
            {selectedIds.size > 0
              ? t('bulk.selected', { count: selectedIds.size, total: totalCount.toLocaleString() })
              : t('bulk.selectAll', { count: transactions.length })}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <>
            <div className="h-6 w-px bg-[var(--color-accent)]/30" />

            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-accent)]">{t('bulk.assign')}</span>
              <select
                data-testid={TEST_IDS.BULK_ACTION_SELECT}
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value)
                  setBulkValue('')
                }}
                className="px-3 py-1.5 border border-[var(--color-accent)]/30 rounded-md text-sm bg-theme-elevated focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">{t('bulk.chooseType')}</option>
                <option value="bucket">{t('bucket')}</option>
                <option value="occasion">{t('occasion')}</option>
                <option value="account">{t('account')}</option>
              </select>

              {bulkAction === 'bucket' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-accent)]/30 rounded-md text-sm bg-theme-elevated focus:ring-2 focus:ring-[var(--color-accent)]"
                >
                  <option value="">{t('bulk.selectBucket')}</option>
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
                >
                  <option value="">{t('bulk.selectOccasion')}</option>
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
                >
                  <option value="">{t('bulk.selectAccount')}</option>
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
                data-testid={TEST_IDS.BULK_APPLY_BUTTON}
                onClick={onBulkApply}
                disabled={bulkLoading}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {bulkLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('bulk.applying')}
                  </span>
                ) : (
                  t('bulk.apply', { count: selectedIds.size })
                )}
              </button>
            )}

            <button
              onClick={() => {
                setSelectedIds(new Set())
                setBulkAction('')
                setBulkValue('')
              }}
              className="ml-auto text-sm text-[var(--color-accent)] hover:opacity-80 font-medium"
            >
              {t('bulk.clearSelection')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
