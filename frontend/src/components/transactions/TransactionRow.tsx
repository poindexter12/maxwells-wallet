'use client'

import { memo, forwardRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useFormat } from '@/hooks/useFormat'
import { useDebouncedClick, createDebouncedHandler } from '@/hooks/useDebouncedClick'
import { SplitTransaction } from '@/components/SplitTransaction'
import { TransactionRowProps, getBucketBorderColor } from './types'

/**
 * TransactionRow - A single transaction row with desktop and mobile layouts.
 *
 * Memoized to prevent unnecessary re-renders in virtualized lists.
 * Uses forwardRef for TanStack Virtual measurement.
 */
export const TransactionRow = memo(forwardRef<HTMLDivElement, TransactionRowProps>(function TransactionRow(
  {
    txn,
    isSelected,
    isExpanded,
    isAddingTag,
    isEditingNote,
    noteValue,
    bucketTags,
    accountTags,
    allTags,
    availableTags,
    onToggleSelect,
    onToggleExpand,
    onBucketChange,
    onAccountChange,
    onAddTag,
    onRemoveTag,
    onStartAddTag,
    onCancelAddTag,
    onToggleTransfer,
    onUnlinkTransfer,
    onStartEditNote,
    onSaveNote,
    onCancelEditNote,
    onNoteChange,
    onDelete,
    onRefresh,
  },
  ref
) {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const { formatCurrency, formatDateShort } = useFormat()
  const nonBucketAccountTags = txn.tags?.filter(t => t.namespace !== 'bucket' && t.namespace !== 'account') || []

  // Debounce handlers for buttons that change UI state on click
  const handleStartAddTag = useDebouncedClick(
    useCallback((e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onStartAddTag(txn.id)
    }, [onStartAddTag, txn.id]),
    150
  )

  // Convert snake_case status to camelCase for translation lookup
  const statusKey = txn.reconciliation_status?.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()) || 'unreconciled'

  return (
    <div
      ref={ref}
      data-transaction-id={txn.id}
      className={`
        border-l-4 ${getBucketBorderColor(txn.bucket)}
        border-b border-theme
        transition-all duration-150 ease-in-out
        text-sm
        ${isSelected
          ? 'bg-[var(--color-accent)]/10'
          : 'hover:bg-[var(--color-bg-hover)]'
        }
      `}
    >
      {/* DESKTOP: Compact table-style grid */}
      <div className="hidden md:block px-4 py-2">
        {/* Top row: checkbox, date, merchant, bucket, account, amount */}
        <div className="flex items-start gap-3">
          {/* Left side: checkbox, date, merchant (about 45%) */}
          <div className="flex items-start gap-3 w-[45%] min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(txn.id)}
              className="w-4 h-4 rounded mt-0.5 flex-shrink-0"
            />
            <span className="text-xs text-theme-muted pt-0.5 w-20 flex-shrink-0">
              {formatDateShort(txn.date)}
            </span>
            <p className="font-medium text-theme truncate min-w-0">
              {txn.merchant || t('merchant')}
            </p>
          </div>

          {/* Right side: bucket, account, amount (about 55%) */}
          <div className="flex items-start gap-3 flex-1">
            <select
              value={txn.bucket || ''}
              onChange={(e) => onBucketChange(txn.id, e.target.value)}
              className="h-7 w-32 rounded border border-theme px-2 text-xs bg-theme-elevated"
            >
              <option value="">{t('bucket')}</option>
              {bucketTags.map((tag) => (
                <option key={tag.id} value={tag.value}>
                  {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={txn.account || ''}
              onChange={(e) => onAccountChange(txn.id, e.target.value)}
              className="h-7 w-40 rounded border border-theme px-2 text-xs bg-theme-elevated"
            >
              <option value="">{t('account')}</option>
              {accountTags.map((tag) => (
                <option key={tag.id} value={tag.value}>
                  {tag.description || tag.value}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 ml-auto flex-shrink-0">
              {txn.is_transfer && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" title={t('transferExcluded')}>
                  {t('transfer')}
                </span>
              )}
              <span className={`font-semibold text-sm ${txn.is_transfer ? 'text-theme-muted' : txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                {formatCurrency(txn.amount, true)}
              </span>
              <button
                onClick={() => onToggleExpand(txn.id)}
                className="text-theme-muted hover:text-theme p-0.5"
                title={isExpanded ? tCommon('collapse') : tCommon('expand')}
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Second row: description + add tag button | tags container */}
        <div className="flex items-center gap-3 mt-1">
          {/* Left side: spacer + description + add tag button */}
          <div className="flex items-center gap-3 w-[45%] min-w-0">
            <div className="w-4 flex-shrink-0"></div>
            <div className="w-20 flex-shrink-0"></div>
            <p className="text-xs text-theme-muted truncate min-w-0 flex-1">
              {txn.description !== txn.merchant ? txn.description : ''}
            </p>
            {/* Add tag button */}
            {isAddingTag ? (
              <div className="inline-flex items-center gap-1 flex-shrink-0">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddTag(txn.id, e.target.value)
                    }
                  }}
                  className="text-xs border rounded px-1 py-0.5 bg-theme-elevated"
                  autoFocus
                  onBlur={onCancelAddTag}
                >
                  <option value="">{tCommon('search')}...</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={`${tag.namespace}:${tag.value}`}>
                      {tag.namespace}:{tag.value}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onCancelAddTag}
                  className="text-xs text-theme-muted hover:text-theme"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartAddTag}
                className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap flex-shrink-0"
                title={tCommon('add')}
              >
                + tag
              </button>
            )}
          </div>

          {/* Right side: tags area */}
          <div className="flex items-center flex-wrap gap-1.5 px-2 py-1 rounded bg-theme-subtle min-h-[1.75rem] flex-1">
            {/* Notes indicator */}
            {txn.notes && !isExpanded && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full" title={txn.notes}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </span>
            )}

            {/* Non-bucket, non-account tags as chips */}
            {nonBucketAccountTags.map((tag) => {
              const fullTag = allTags.find(t => t.namespace === tag.namespace && t.value === tag.value)
              const displayText = fullTag?.description || tag.value.replace(/-/g, ' ')
              return (
                <span
                  key={tag.full}
                  className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700"
                  title={`${tag.namespace}:${tag.value}`}
                >
                  {displayText}
                  <button
                    onClick={createDebouncedHandler(() => onRemoveTag(txn.id, tag.full), tag)}
                    className="hover:text-purple-900 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )
            })}

            {/* Empty state */}
            {nonBucketAccountTags.length === 0 && !txn.notes && (
              <span className="text-[11px] text-theme-muted/40">—</span>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE: Card-style layout */}
      <div className="md:hidden px-4 py-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(txn.id)}
            className="w-4 h-4 mt-1 rounded"
          />

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-theme truncate">
                  {txn.merchant || t('merchant')}
                </p>
                <p className="text-xs text-theme-muted">
                  {formatDateShort(txn.date)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {txn.is_transfer && (
                  <span className="px-1 py-0.5 text-xs rounded bg-blue-100 text-blue-700" title={t('transfer')}>
                    T
                  </span>
                )}
                <span className={`font-semibold ${txn.is_transfer ? 'text-theme-muted' : txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(txn.amount, true)}
                </span>
                <button
                  onClick={() => onToggleExpand(txn.id)}
                  className="text-theme-muted hover:text-theme p-0.5"
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile controls row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <select
                value={txn.bucket || ''}
                onChange={(e) => onBucketChange(txn.id, e.target.value)}
                className="h-7 rounded border border-theme px-2 text-xs bg-theme-elevated"
              >
                <option value="">{t('bucket')}</option>
                {bucketTags.map((tag) => (
                  <option key={tag.id} value={tag.value}>
                    {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={txn.account || ''}
                onChange={(e) => onAccountChange(txn.id, e.target.value)}
                className="h-7 rounded border border-theme px-2 text-xs bg-theme-elevated"
              >
                <option value="">{t('account')}</option>
                {accountTags.map((tag) => (
                  <option key={tag.id} value={tag.value}>
                    {tag.description || tag.value}
                  </option>
                ))}
              </select>

              {/* Tags */}
              {nonBucketAccountTags.map((tag) => {
                const fullTag = allTags.find(t => t.namespace === tag.namespace && t.value === tag.value)
                const displayText = fullTag?.description || tag.value.replace(/-/g, ' ')
                return (
                  <span
                    key={tag.full}
                    className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700"
                  >
                    {displayText}
                    <button onClick={createDebouncedHandler(() => onRemoveTag(txn.id, tag.full), tag)} className="hover:text-purple-900">×</button>
                  </span>
                )
              })}

              <button
                onClick={handleStartAddTag}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                + tag
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* EXPANDED METADATA SECTION */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 md:pl-12 border-t border-theme bg-[var(--color-bg-hover)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {/* Left column: metadata */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="text-theme-muted w-24">{tFields('status')}:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  txn.reconciliation_status === 'matched' ? 'bg-green-100 text-green-800' :
                  txn.reconciliation_status === 'ignored' ? 'bg-gray-100 text-gray-600' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {t(`status.${statusKey}`)}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-theme-muted w-24">{tFields('description')}:</span>
                <span className="text-theme">{txn.description}</span>
              </div>
              {txn.account_source && (
                <div className="flex gap-2">
                  <span className="text-theme-muted w-24">{t('source')}:</span>
                  <span className="text-theme-muted text-xs">{txn.account_source}</span>
                </div>
              )}
              {txn.category && (
                <div className="flex gap-2">
                  <span className="text-theme-muted w-24">Legacy cat:</span>
                  <span className="text-theme-muted italic">{txn.category}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-theme-muted w-24">ID:</span>
                <span className="text-theme-muted font-mono text-xs">{txn.id}</span>
              </div>
              {/* Transfer controls */}
              <div className="flex gap-2 items-center">
                <span className="text-theme-muted w-24">{t('transfer')}:</span>
                <button
                  onClick={() => onToggleTransfer(txn.id, txn.is_transfer || false)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    txn.is_transfer
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={txn.is_transfer ? 'Click to unmark as transfer' : 'Click to mark as transfer'}
                >
                  {txn.is_transfer ? '✓ Marked as Transfer' : 'Not a Transfer'}
                </button>
              </div>
              {txn.linked_transaction_id && (
                <div className="flex gap-2 items-center">
                  <span className="text-theme-muted w-24">Linked to:</span>
                  <span className="text-theme font-mono text-xs">#{txn.linked_transaction_id}</span>
                  <button
                    onClick={() => onUnlinkTransfer(txn.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                    title="Unlink this transfer pair"
                  >
                    Unlink
                  </button>
                </div>
              )}
            </div>

            {/* Middle column: notes */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-theme-muted">{tFields('notes')}:</span>
                {!isEditingNote && (
                  <button
                    onClick={() => onStartEditNote(txn)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    {txn.notes ? tCommon('edit') : 'Add note'}
                  </button>
                )}
              </div>
              {isEditingNote ? (
                <div className="space-y-2">
                  <textarea
                    value={noteValue}
                    onChange={(e) => onNoteChange(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-theme rounded resize-none bg-theme-elevated"
                    rows={2}
                    placeholder="Add a note..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => onSaveNote(txn.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      {tCommon('save')}
                    </button>
                    <button
                      onClick={onCancelEditNote}
                      className="px-2 py-1 text-xs border border-theme rounded hover:bg-[var(--color-bg-hover)]"
                    >
                      {tCommon('cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-theme text-sm whitespace-pre-wrap">
                  {txn.notes || <span className="text-theme-muted italic">No notes</span>}
                </p>
              )}
            </div>

            {/* Right column: splits & actions */}
            <div className="border-l border-theme pl-4 space-y-3">
              <SplitTransaction
                transactionId={txn.id}
                transactionAmount={txn.amount}
                bucketTags={bucketTags}
                onSplitsChanged={onRefresh}
              />
              <div className="pt-2 border-t border-theme">
                <button
                  onClick={() => onDelete(txn.id)}
                  className="px-2 py-1 text-xs text-red-500 border border-red-300 rounded hover:bg-red-50"
                >
                  {tCommon('delete')} Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}))

TransactionRow.displayName = 'TransactionRow'

export default TransactionRow
