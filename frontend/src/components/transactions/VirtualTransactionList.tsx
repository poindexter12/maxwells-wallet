'use client'

import { useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TransactionRow } from './TransactionRow'
import { Transaction, Tag } from './types'

interface VirtualTransactionListProps {
  transactions: Transaction[]
  selectedIds: Set<number>
  expandedIds: Set<number>
  addingTagTo: number | null
  editingNoteId: number | null
  noteValue: string
  bucketTags: Tag[]
  accountTags: Tag[]
  allTags: Tag[]
  getAvailableTagsForTransaction: (txn: Transaction) => Tag[]

  // Callbacks
  onToggleSelect: (id: number) => void
  onToggleExpand: (id: number) => void
  onBucketChange: (id: number, bucket: string) => void
  onAccountChange: (id: number, account: string) => void
  onAddTag: (id: number, tagValue: string) => void
  onRemoveTag: (id: number, tagFull: string) => void
  onStartAddTag: (id: number) => void
  onCancelAddTag: () => void
  onToggleTransfer: (id: number, currentValue: boolean) => void
  onUnlinkTransfer: (id: number) => void
  onStartEditNote: (txn: Transaction) => void
  onSaveNote: (id: number) => void
  onCancelEditNote: () => void
  onNoteChange: (value: string) => void
  onDelete: (id: number) => void
  onRefresh: () => void

  // Infinite scroll
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void

  // Estimated row height (collapsed row)
  estimatedRowHeight?: number
}

/**
 * VirtualTransactionList - Virtualized transaction list using TanStack Virtual.
 *
 * Features:
 * - Dynamic row heights (expanded rows are taller)
 * - Infinite scroll support
 * - Efficient rendering of 50k+ transactions
 */
export function VirtualTransactionList({
  transactions,
  selectedIds,
  expandedIds,
  addingTagTo,
  editingNoteId,
  noteValue,
  bucketTags,
  accountTags,
  allTags,
  getAvailableTagsForTransaction,
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
  hasMore,
  loadingMore,
  onLoadMore,
  estimatedRowHeight = 76, // Default collapsed row height
}: VirtualTransactionListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Virtualizer instance
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(
      (index: number) => {
        const txn = transactions[index]
        // Expanded rows are much taller (~300px), collapsed ~76px
        return expandedIds.has(txn.id) ? 320 : estimatedRowHeight
      },
      [transactions, expandedIds, estimatedRowHeight]
    ),
    overscan: 5, // Render 5 extra items above/below viewport
    measureElement: (element) => {
      // Dynamic measurement for accurate heights
      return element.getBoundingClientRect().height
    },
  })

  // Infinite scroll using IntersectionObserver
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  // Re-measure when expanded rows change
  useEffect(() => {
    virtualizer.measure()
  }, [expandedIds, virtualizer])

  const virtualItems = virtualizer.getVirtualItems()

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-theme-muted">
        No transactions found
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const txn = transactions[virtualRow.index]
          return (
            <div
              key={txn.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TransactionRow
                txn={txn}
                isSelected={selectedIds.has(txn.id)}
                isExpanded={expandedIds.has(txn.id)}
                isAddingTag={addingTagTo === txn.id}
                isEditingNote={editingNoteId === txn.id}
                noteValue={noteValue}
                bucketTags={bucketTags}
                accountTags={accountTags}
                allTags={allTags}
                availableTags={getAvailableTagsForTransaction(txn)}
                onToggleSelect={onToggleSelect}
                onToggleExpand={onToggleExpand}
                onBucketChange={onBucketChange}
                onAccountChange={onAccountChange}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onStartAddTag={onStartAddTag}
                onCancelAddTag={onCancelAddTag}
                onToggleTransfer={onToggleTransfer}
                onUnlinkTransfer={onUnlinkTransfer}
                onStartEditNote={onStartEditNote}
                onSaveNote={onSaveNote}
                onCancelEditNote={onCancelEditNote}
                onNoteChange={onNoteChange}
                onDelete={onDelete}
                onRefresh={onRefresh}
              />
            </div>
          )
        })}
      </div>

      {/* Loading more indicator / Intersection Observer target */}
      <div ref={loadMoreRef} className="py-4 text-center">
        {loadingMore && (
          <span className="text-theme-muted">Loading more transactions...</span>
        )}
        {!hasMore && transactions.length > 0 && (
          <span className="text-theme-muted text-sm">
            All {transactions.length} transactions loaded
          </span>
        )}
      </div>
    </div>
  )
}

export default VirtualTransactionList
