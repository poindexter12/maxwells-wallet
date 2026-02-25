'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHelp } from '@/components/PageHelp'
import { VirtualTransactionList, TransactionFilters, BulkActions } from '@/components/transactions'
import { TEST_IDS } from '@/test-ids'
import { useFormat } from '@/hooks/useFormat'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface TransactionTag {
  namespace: string
  value: string
  full: string
}

interface Transaction {
  id: number
  date: string
  amount: number
  description: string
  merchant: string | null
  account_source: string
  account_tag_id: number | null  // FK to account tag
  category: string | null  // Legacy field
  reconciliation_status: string
  notes?: string | null
  tags?: TransactionTag[]
  bucket?: string  // Convenience field we'll compute
  account?: string  // Convenience field we'll compute from account tag
  is_transfer?: boolean  // True if marked as internal transfer
  linked_transaction_id?: number | null  // ID of linked transfer pair
}

const PAGE_SIZE = 50

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
  const tFields = useTranslations('fields')
  const { formatCurrency, getDefaultLargeThreshold } = useFormat()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [accountTags, setAccountTags] = useState<Tag[]>([])
  const [occasionTags, setOccasionTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
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
  // Separate state for search input to prevent refetch on every keystroke
  const [searchInput, setSearchInput] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [addingTagTo, setAddingTagTo] = useState<number | null>(null)
  const [_newTagValue, setNewTagValue] = useState('')

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  // Expanded rows for metadata
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // Inline notes editing
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [noteValue, setNoteValue] = useState('')

  // Dynamic large transaction threshold (from anomaly detection)
  const [largeThreshold, setLargeThreshold] = useState<number | null>(null)

  // Infinite scroll refs
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // AbortController for cancelling in-flight requests when filters change rapidly
  const abortControllerRef = useRef<AbortController | null>(null)

  // Debounce filters to prevent rapid API calls (e.g., from rapid button clicks)
  // Using JSON.stringify to create a stable string for comparison
  const debouncedFilters = useDebouncedValue(JSON.stringify(filters), 150)

  // Initialize filters from URL params on mount and when URL changes
  // Using searchParams.toString() ensures we detect all URL param changes
  const searchParamsString = searchParams.toString()
  useEffect(() => {
    const bucket = searchParams.get('bucket') || ''
    const occasion = searchParams.get('occasion') || ''
    // Support both single 'account' param and multiple 'accounts' params
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

    // Combine single account with multi-accounts
    const accounts = accountSingle
      ? [accountSingle, ...accountsMulti]
      : accountsMulti

    // Check if we have any advanced filters in URL
    const hasAdvanced = status || amountMin || amountMax || startDate || endDate || accountsExclude.length > 0 || transfers !== 'hide'
    if (hasAdvanced) {
      setShowAdvancedFilters(true)
    }

    setFilters({
      search,
      bucket,
      occasion,
      accounts,
      accountsExclude,
      status,
      amountMin,
      amountMax,
      startDate,
      endDate,
      transfers
    })
    setSearchInput(search) // Sync search input with URL param
    setFiltersInitialized(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsString]) // Parse URL params when they change

  // Fetch tags and anomaly threshold on mount
  useEffect(() => {
    fetchBucketTags()
    fetchAllTags()
    fetchAccountTags()
    fetchOccasionTags()
    fetchLargeThreshold()
  }, []) // Fetch reference data once on mount

  // Fetch the dynamic large transaction threshold from anomaly detection
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

  // Fetch transactions when filters are initialized or change (debounced)
  useEffect(() => {
    if (filtersInitialized) {
      // Cancel any in-flight request before starting a new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Create new AbortController for this request
      const controller = new AbortController()
      abortControllerRef.current = controller

      fetchTransactions(controller.signal)
    }

    // Cleanup: abort request if component unmounts or filters change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersInitialized, debouncedFilters]) // Refetch when debounced filters change

  async function fetchOccasionTags() {
    try {
      const res = await fetch('/api/v1/tags?namespace=occasion')
      const data = await res.json()
      setOccasionTags(data)
    } catch (error) {
      console.error('Error fetching occasion tags:', error)
    }
  }

  async function fetchBucketTags() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      const data = await res.json()
      setBucketTags(data)
    } catch (error) {
      console.error('Error fetching bucket tags:', error)
    }
  }

  async function fetchAllTags() {
    try {
      const res = await fetch('/api/v1/tags')
      const data = await res.json()
      setAllTags(data)
    } catch (error) {
      console.error('Error fetching all tags:', error)
    }
  }

  async function fetchAccountTags() {
    try {
      const res = await fetch('/api/v1/tags?namespace=account')
      const data = await res.json()
      setAccountTags(data)
    } catch (error) {
      console.error('Error fetching account tags:', error)
    }
  }

  function _getAccountDisplayName(accountSource: string): string {
    const accountTag = accountTags.find(t => t.value === accountSource.toLowerCase().replace(/\s+/g, '-'))
    return accountTag?.description || accountSource
  }

  // Build URL params from filters
  function buildFilterParams(): URLSearchParams {
    const params = new URLSearchParams()
    if (filters.search) params.append('search', filters.search)
    if (filters.bucket) params.append('tag', `bucket:${filters.bucket}`)
    if (filters.occasion) params.append('tag', `occasion:${filters.occasion}`)
    filters.accounts.forEach(acc => params.append('account', acc))
    filters.accountsExclude.forEach(acc => params.append('account_exclude', acc))
    if (filters.status) params.append('reconciliation_status', filters.status)
    if (filters.amountMin) params.append('amount_min', filters.amountMin)
    if (filters.amountMax) params.append('amount_max', filters.amountMax)
    if (filters.startDate) params.append('start_date', filters.startDate)
    if (filters.endDate) params.append('end_date', filters.endDate)
    // Transfer filter: hide=false, only=true, all=no param
    if (filters.transfers === 'hide') params.append('is_transfer', 'false')
    else if (filters.transfers === 'only') params.append('is_transfer', 'true')
    return params
  }

  // Fetch total count
  async function fetchTotalCount() {
    try {
      const params = buildFilterParams()
      const res = await fetch(`/api/v1/transactions/count?${params.toString()}`)
      const data = await res.json()
      setTotalCount(data.count)
    } catch (error) {
      console.error('Error fetching count:', error)
    }
  }

  // Fetch transactions with tags
  async function fetchTransactionsWithTags(txns: Transaction[]): Promise<Transaction[]> {
    return await Promise.all(
      txns.map(async (txn: Transaction) => {
        try {
          const tagsRes = await fetch(`/api/v1/transactions/${txn.id}/tags`)
          const tagsData = await tagsRes.json()
          const tags = tagsData.tags || []
          const bucketTag = tags.find((t: TransactionTag) => t.namespace === 'bucket')
          const accountTag = tags.find((t: TransactionTag) => t.namespace === 'account')
          return {
            ...txn,
            tags,
            bucket: bucketTag?.value || null,
            account: accountTag?.value || null
          }
        } catch {
          return { ...txn, tags: [], bucket: null, account: null }
        }
      })
    )
  }

  // Initial fetch (resets list) - uses cursor pagination
  async function fetchTransactions(signal?: AbortSignal) {
    setLoading(true)
    try {
      const params = buildFilterParams()
      params.append('limit', PAGE_SIZE.toString())
      // No cursor for initial fetch

      const res = await fetch(`/api/v1/transactions/paginated?${params.toString()}`, { signal })

      // Check if aborted before processing response
      if (signal?.aborted) return

      const data = await res.json()

      // Check again after parsing JSON
      if (signal?.aborted) return

      const transactionsWithTags = await fetchTransactionsWithTags(data.items || [])

      // Final check before setting state
      if (signal?.aborted) return

      setTransactions(transactionsWithTags)
      setNextCursor(data.next_cursor || null)
      setHasMore(data.has_more || false)
      setLoading(false)

      // Also fetch total count
      fetchTotalCount()
    } catch (error) {
      // Ignore abort errors - they're expected when cancelling requests
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('Error fetching transactions:', error)
      setLoading(false)
    }
  }

  // Load more transactions (append to list) - uses cursor pagination
  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return

    setLoadingMore(true)
    try {
      const params = buildFilterParams()
      params.append('limit', PAGE_SIZE.toString())
      params.append('cursor', nextCursor)

      const res = await fetch(`/api/v1/transactions/paginated?${params.toString()}`)
      const data = await res.json()

      if (data.items && data.items.length > 0) {
        const transactionsWithTags = await fetchTransactionsWithTags(data.items)
        setTransactions(prev => [...prev, ...transactionsWithTags])
      }

      setNextCursor(data.next_cursor || null)
      setHasMore(data.has_more || false)
    } catch (error) {
      console.error('Error loading more transactions:', error)
    } finally {
      setLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, hasMore, nextCursor, filters]) // buildFilterParams uses filters

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
