'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHelp } from '@/components/PageHelp'
import {
  VirtualTransactionList,
  TransactionFilters,
  BulkActions,
  useTransactionData,
  type Tag,
  type Transaction,
} from '@/components/transactions'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

// Wrapper component with Suspense boundary for useSearchParams
export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsLoadingFallback />}>
      <TransactionsContent />
    </Suspense>
  )
}

function TransactionsLoadingFallback() {
  const t = useTranslations('common')
  return <div className="text-center py-12">{t('loading')}</div>
}

function TransactionsContent() {
  const searchParams = useSearchParams()
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  // Filter state
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    bucket: '',
    occasion: '',
    accounts: [] as string[],        // Multiple account selection
    accountsExclude: [] as string[], // Accounts to exclude
    status: '',
    amountMin: '',
    amountMax: '',
    startDate: '',
    endDate: '',
    transfers: 'hide' as 'all' | 'hide' | 'only'  // Transfer filter: all, hide, only
  })
  const [searchInput, setSearchInput] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  // Debounce filters to prevent rapid API calls
  const debouncedFilters = useDebouncedValue(JSON.stringify(filters), 150)

  // Use data fetching hook
  const {
    transactions,
    totalCount,
    bucketTags,
    allTags,
    accountTags,
    occasionTags,
    loading,
    loadingMore,
    hasMore,
    fetchTransactions,
    loadMoreTransactions,
  } = useTransactionData({ filters, filtersInitialized, debouncedFilters })

  // UI state
  const [addingTagTo, setAddingTagTo] = useState<number | null>(null)
  const [_newTagValue, setNewTagValue] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [largeThreshold, setLargeThreshold] = useState<number | null>(null)

  // Infinite scroll refs
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // Initialize filters from URL params
  const searchParamsString = searchParams.toString()
  useEffect(() => {
    const bucket = searchParams.get('bucket') || ''
    const occasion = searchParams.get('occasion') || ''
    const accountSingle = searchParams.get('account') || ''
    const accountsMulti = searchParams.getAll('accounts')
    const accountsExclude = searchParams.getAll('accounts_exclude')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const amountMin = searchParams.get('amount_min') || ''
    const amountMax = searchParams.get('amount_max') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const transfersParam = searchParams.get('transfers') || 'hide'
    const transfers = (['all', 'hide', 'only'].includes(transfersParam) ? transfersParam : 'hide') as 'all' | 'hide' | 'only'
    const accounts = accountSingle ? [accountSingle, ...accountsMulti] : accountsMulti
    const hasAdvanced = status || amountMin || amountMax || startDate || endDate || accountsExclude.length > 0 || transfers !== 'hide'
    if (hasAdvanced) setShowAdvancedFilters(true)
    setFilters({ search, bucket, occasion, accounts, accountsExclude, status, amountMin, amountMax, startDate, endDate, transfers })
    setSearchInput(search)
    setFiltersInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString])

  // Fetch anomaly threshold on mount
  useEffect(() => {
    async function fetchLargeThreshold() {
      try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const res = await fetch(`/api/v1/reports/anomalies?year=${year}&month=${month}`)
        if (res.ok) {
          const data = await res.json()
          if (data.summary?.large_threshold_amount) {
            setLargeThreshold(Math.round(data.summary.large_threshold_amount))
          }
        }
      } catch (error) {
        console.error('Error fetching anomaly threshold:', error)
      }
    }
    fetchLargeThreshold()
  }, [])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreTransactions()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, loadingMore, loading, loadMoreTransactions])

  async function handleBucketChange(txnId: number, newBucket: string) {
    try {
      if (newBucket) {
        // Add the new bucket tag (backend will replace existing bucket)
        await fetch(`/api/v1/transactions/${txnId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: `bucket:${newBucket}` })
        })
      } else {
        // Find current bucket and remove it
        const txn = transactions.find(t => t.id === txnId)
        if (txn?.bucket) {
          await fetch(`/api/v1/transactions/${txnId}/tags/bucket:${txn.bucket}`, {
            method: 'DELETE'
          })
        }
      }
      fetchTransactions()
    } catch (error) {
      console.error('Error updating transaction bucket:', error)
    }
  }

  async function handleAccountChange(txnId: number, newAccountValue: string) {
    try {
      // Find the account tag ID from the account tags
      const accountTag = accountTags.find(t => t.value === newAccountValue)
      const newAccountTagId = accountTag?.id || null

      // Update using PATCH endpoint
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_tag_id: newAccountTagId })
      })

      // Also update the account tag through the tags system for consistency
      const txn = transactions.find(t => t.id === txnId)
      // Remove existing account tag if any
      if (txn?.account) {
        await fetch(`/api/v1/transactions/${txnId}/tags/account:${txn.account}`, {
          method: 'DELETE'
        }).catch(() => {}) // Ignore errors if tag doesn't exist
      }
      // Add new account tag if specified
      if (newAccountValue) {
        await fetch(`/api/v1/transactions/${txnId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: `account:${newAccountValue}` })
        }).catch(() => {}) // Ignore errors if tag already exists
      }

      fetchTransactions()
    } catch (error) {
      console.error('Error updating transaction account:', error)
    }
  }

  async function handleRemoveTag(txnId: number, tagFull: string) {
    try {
      await fetch(`/api/v1/transactions/${txnId}/tags/${tagFull}`, {
        method: 'DELETE'
      })
      fetchTransactions()
    } catch (error) {
      console.error('Error removing tag:', error)
    }
  }

  async function handleAddTag(txnId: number, tagFull: string) {
    if (!tagFull) return
    try {
      await fetch(`/api/v1/transactions/${txnId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagFull })
      })
      setAddingTagTo(null)
      setNewTagValue('')
      fetchTransactions()
    } catch (error) {
      console.error('Error adding tag:', error)
    }
  }

  // Get tags that aren't already on this transaction (excluding bucket and account namespaces)
  function getAvailableTagsForTransaction(txn: Transaction): Tag[] {
    const existingTags = new Set(txn.tags?.map(t => t.full) || [])
    return allTags.filter(t =>
      t.namespace !== 'bucket' &&
      t.namespace !== 'account' &&
      !existingTags.has(`${t.namespace}:${t.value}`)
    )
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)))
    }
  }

  async function handleBulkApply() {
    if (!bulkAction || !bulkValue || selectedIds.size === 0) return

    setBulkLoading(true)
    try {
      const promises = Array.from(selectedIds).map(async (txnId) => {
        await fetch(`/api/v1/transactions/${txnId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: bulkValue })
        })
      })

      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkAction('')
      setBulkValue('')
      fetchTransactions()
    } catch (error) {
      console.error('Error applying bulk action:', error)
    } finally {
      setBulkLoading(false)
    }
  }

  // Toggle expanded metadata view
  function toggleExpand(id: number) {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setExpandedIds(newSet)
  }

  // Toggle transfer status
  async function handleToggleTransfer(txnId: number, currentIsTransfer: boolean) {
    try {
      await fetch('/api/v1/transfers/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: [txnId],
          is_transfer: !currentIsTransfer
        })
      })
      fetchTransactions()
    } catch (error) {
      console.error('Error toggling transfer status:', error)
    }
  }

  // Unlink a transfer pair
  async function handleUnlinkTransfer(txnId: number) {
    try {
      await fetch(`/api/v1/transfers/${txnId}/link`, {
        method: 'DELETE'
      })
      fetchTransactions()
    } catch (error) {
      console.error('Error unlinking transfer:', error)
    }
  }

  // Handle notes save
  async function handleSaveNote(txnId: number) {
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: noteValue.trim() || null })
      })
      setEditingNoteId(null)
      setNoteValue('')
      fetchTransactions()
    } catch (error) {
      console.error('Error saving note:', error)
    }
  }

  // Start editing note
  function startEditNote(txn: Transaction) {
    setEditingNoteId(txn.id)
    setNoteValue(txn.notes || '')
  }

  // Delete a transaction
  async function handleDeleteTransaction(txnId: number) {
    if (!confirm(t('confirmDelete'))) {
      return
    }
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'DELETE'
      })
      fetchTransactions()
    } catch (error) {
      console.error('Error deleting transaction:', error)
    }
  }

  // Cancel adding tag
  function handleCancelAddTag() {
    setAddingTagTo(null)
    setNewTagValue('')
  }

  // Cancel editing note
  function handleCancelEditNote() {
    setEditingNoteId(null)
    setNoteValue('')
  }

  if (loading) {
    return <div className="text-center py-12">{tCommon('loading')}</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp pageId="transactions" />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">{t('title')}</h1>
          {totalCount > 0 && (
            <p className="text-sm text-theme-muted mt-1">
              {t('subtitle', { count: transactions.length.toLocaleString(), total: totalCount.toLocaleString() })}
            </p>
          )}
        </div>
        <Link
          href="/import"
          className="btn-primary"
        >
          {t('importCsv', { defaultValue: 'Import CSV' })}
        </Link>
      </div>

      <TransactionFilters
        filters={filters}
        setFilters={setFilters}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        showAccountDropdown={showAccountDropdown}
        setShowAccountDropdown={setShowAccountDropdown}
        bucketTags={bucketTags}
        occasionTags={occasionTags}
        accountTags={accountTags}
        largeThreshold={largeThreshold}
      />

      <BulkActions
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        transactions={transactions}
        totalCount={totalCount}
        bucketTags={bucketTags}
        occasionTags={occasionTags}
        accountTags={accountTags}
        onBulkApply={handleBulkApply}
        bulkAction={bulkAction}
        setBulkAction={setBulkAction}
        bulkValue={bulkValue}
        setBulkValue={setBulkValue}
        bulkLoading={bulkLoading}
        onToggleSelectAll={toggleSelectAll}
      />

      {/* Transactions List - Virtualized */}
      <div className="card">
        <VirtualTransactionList
          transactions={transactions}
          selectedIds={selectedIds}
          expandedIds={expandedIds}
          addingTagTo={addingTagTo}
          editingNoteId={editingNoteId}
          noteValue={noteValue}
          bucketTags={bucketTags}
          accountTags={accountTags}
          allTags={allTags}
          getAvailableTagsForTransaction={getAvailableTagsForTransaction}
          onToggleSelect={toggleSelect}
          onToggleExpand={toggleExpand}
          onBucketChange={handleBucketChange}
          onAccountChange={handleAccountChange}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onStartAddTag={setAddingTagTo}
          onCancelAddTag={handleCancelAddTag}
          onToggleTransfer={handleToggleTransfer}
          onUnlinkTransfer={handleUnlinkTransfer}
          onStartEditNote={startEditNote}
          onSaveNote={handleSaveNote}
          onCancelEditNote={handleCancelEditNote}
          onNoteChange={setNoteValue}
          onDelete={handleDeleteTransaction}
          onRefresh={fetchTransactions}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMoreTransactions}
        />
      </div>
    </div>
  )
}
