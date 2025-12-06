'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PageHelp } from '@/components/PageHelp'
import { Tag, Transaction, TransactionTag, TransactionFilters, INITIAL_FILTERS } from '@/types/transactions'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import TransactionFiltersComponent from '@/components/transactions/TransactionFilters'
import BulkActionsBar from '@/components/transactions/BulkActionsBar'
import TransactionRow from '@/components/transactions/TransactionRow'

const PAGE_SIZE = 50

// Wrapper component with Suspense boundary for useSearchParams
export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12">Loading...</div>}>
      <TransactionsContent />
    </Suspense>
  )
}

function TransactionsContent() {
  const searchParams = useSearchParams()

  // Transaction data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Tags data
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [accountTags, setAccountTags] = useState<Tag[]>([])
  const [occasionTags, setOccasionTags] = useState<Tag[]>([])

  // Filter state
  const [filters, setFilters] = useState<TransactionFilters>(INITIAL_FILTERS)
  const [searchInput, setSearchInput] = useState('')
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  const [largeThreshold, setLargeThreshold] = useState<number | null>(null)

  // Bulk selection (using extracted hook)
  const bulkSelection = useBulkSelection<Transaction>()

  // Expanded rows for metadata
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

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
    setSearchInput(search)
    setFiltersInitialized(true)
  }, [searchParamsString])

  // Fetch tags and anomaly threshold on mount
  useEffect(() => {
    fetchBucketTags()
    fetchAllTags()
    fetchAccountTags()
    fetchOccasionTags()
    fetchLargeThreshold()
  }, [])

  // Fetch transactions when filters change
  useEffect(() => {
    if (filtersInitialized) {
      fetchTransactions()
    }
  }, [filtersInitialized, filters])

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreTransactions()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => { if (observerRef.current) observerRef.current.disconnect() }
  }, [hasMore, loadingMore, loading])

  // Data fetching functions
  async function fetchLargeThreshold() {
    try {
      const now = new Date()
      const res = await fetch(`/api/v1/reports/anomalies?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
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

  async function fetchOccasionTags() {
    try {
      const res = await fetch('/api/v1/tags?namespace=occasion')
      setOccasionTags(await res.json())
    } catch (error) { console.error('Error fetching occasion tags:', error) }
  }

  async function fetchBucketTags() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      setBucketTags(await res.json())
    } catch (error) { console.error('Error fetching bucket tags:', error) }
  }

  async function fetchAllTags() {
    try {
      const res = await fetch('/api/v1/tags')
      setAllTags(await res.json())
    } catch (error) { console.error('Error fetching all tags:', error) }
  }

  async function fetchAccountTags() {
    try {
      const res = await fetch('/api/v1/tags?namespace=account')
      setAccountTags(await res.json())
    } catch (error) { console.error('Error fetching account tags:', error) }
  }

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
    if (filters.transfers === 'hide') params.append('is_transfer', 'false')
    else if (filters.transfers === 'only') params.append('is_transfer', 'true')
    return params
  }

  async function fetchTotalCount() {
    try {
      const params = buildFilterParams()
      const res = await fetch(`/api/v1/transactions/count?${params.toString()}`)
      const data = await res.json()
      setTotalCount(data.count)
    } catch (error) { console.error('Error fetching count:', error) }
  }

  async function fetchTransactionsWithTags(txns: Transaction[]): Promise<Transaction[]> {
    return await Promise.all(
      txns.map(async (txn) => {
        try {
          const tagsRes = await fetch(`/api/v1/transactions/${txn.id}/tags`)
          const tagsData = await tagsRes.json()
          const tags = tagsData.tags || []
          const bucketTag = tags.find((t: TransactionTag) => t.namespace === 'bucket')
          const accountTag = tags.find((t: TransactionTag) => t.namespace === 'account')
          return { ...txn, tags, bucket: bucketTag?.value || null, account: accountTag?.value || null }
        } catch {
          return { ...txn, tags: [], bucket: null, account: null }
        }
      })
    )
  }

  async function fetchTransactions() {
    setLoading(true)
    try {
      const params = buildFilterParams()
      params.append('limit', PAGE_SIZE.toString())
      params.append('skip', '0')

      const res = await fetch(`/api/v1/transactions?${params.toString()}`)
      const data = await res.json()
      const transactionsWithTags = await fetchTransactionsWithTags(data)

      setTransactions(transactionsWithTags)
      setHasMore(data.length === PAGE_SIZE)
      setLoading(false)
      fetchTotalCount()
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setLoading(false)
    }
  }

  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const params = buildFilterParams()
      params.append('limit', PAGE_SIZE.toString())
      params.append('skip', transactions.length.toString())

      const res = await fetch(`/api/v1/transactions?${params.toString()}`)
      const data = await res.json()

      if (data.length > 0) {
        const transactionsWithTags = await fetchTransactionsWithTags(data)
        setTransactions(prev => [...prev, ...transactionsWithTags])
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch (error) {
      console.error('Error loading more transactions:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, transactions.length, filters])

  // Transaction handlers
  async function handleBucketChange(txnId: number, newBucket: string) {
    try {
      if (newBucket) {
        await fetch(`/api/v1/transactions/${txnId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: `bucket:${newBucket}` })
        })
      } else {
        const txn = transactions.find(t => t.id === txnId)
        if (txn?.bucket) {
          await fetch(`/api/v1/transactions/${txnId}/tags/bucket:${txn.bucket}`, { method: 'DELETE' })
        }
      }
      fetchTransactions()
    } catch (error) { console.error('Error updating transaction bucket:', error) }
  }

  async function handleAccountChange(txnId: number, newAccountValue: string) {
    try {
      const accountTag = accountTags.find(t => t.value === newAccountValue)
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_tag_id: accountTag?.id || null })
      })

      const txn = transactions.find(t => t.id === txnId)
      if (txn?.account) {
        await fetch(`/api/v1/transactions/${txnId}/tags/account:${txn.account}`, { method: 'DELETE' }).catch(() => {})
      }
      if (newAccountValue) {
        await fetch(`/api/v1/transactions/${txnId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag: `account:${newAccountValue}` })
        }).catch(() => {})
      }
      fetchTransactions()
    } catch (error) { console.error('Error updating transaction account:', error) }
  }

  async function handleRemoveTag(txnId: number, tagFull: string) {
    try {
      await fetch(`/api/v1/transactions/${txnId}/tags/${tagFull}`, { method: 'DELETE' })
      fetchTransactions()
    } catch (error) { console.error('Error removing tag:', error) }
  }

  async function handleAddTag(txnId: number, tagFull: string) {
    if (!tagFull) return
    try {
      await fetch(`/api/v1/transactions/${txnId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagFull })
      })
      fetchTransactions()
    } catch (error) { console.error('Error adding tag:', error) }
  }

  async function handleToggleTransfer(txnId: number, currentIsTransfer: boolean) {
    try {
      await fetch('/api/v1/transfers/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: [txnId], is_transfer: !currentIsTransfer })
      })
      fetchTransactions()
    } catch (error) { console.error('Error toggling transfer status:', error) }
  }

  async function handleUnlinkTransfer(txnId: number) {
    try {
      await fetch(`/api/v1/transfers/${txnId}/link`, { method: 'DELETE' })
      fetchTransactions()
    } catch (error) { console.error('Error unlinking transfer:', error) }
  }

  async function handleSaveNote(txnId: number, note: string) {
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note || null })
      })
      fetchTransactions()
    } catch (error) { console.error('Error saving note:', error) }
  }

  async function handleBulkApplyTag(tagFull: string, ids: number[]) {
    await Promise.all(ids.map(txnId =>
      fetch(`/api/v1/transactions/${txnId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: tagFull })
      })
    ))
    bulkSelection.clearSelection()
    fetchTransactions()
  }

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSearch() {
    setFilters({ ...filters, search: searchInput })
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="transactions"
        title="Transactions Help"
        description="View, filter, and categorize all your imported transactions. Use buckets for spending categories and tags for special tracking like trips or projects."
        steps={[
          "Use the Bucket dropdown to categorize each transaction (groceries, dining, etc.)",
          "Add occasion tags for trips, events, or projects you want to track separately",
          "Select multiple transactions with checkboxes for bulk categorization",
          "Click the expand arrow (▼) to see full details, add notes, or edit metadata",
          "Use filters to find specific transactions by date, amount, account, or text search"
        ]}
        tips={[
          "Set up Rules to automatically categorize recurring merchants",
          "Shift+click accounts in the filter to exclude them instead of include",
          "The colored left border shows the bucket category at a glance"
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Transactions</h1>
          {totalCount > 0 && (
            <p className="text-sm text-theme-muted mt-1">
              Showing {transactions.length.toLocaleString()} of {totalCount.toLocaleString()} transactions
            </p>
          )}
        </div>
        <Link href="/import" className="btn-primary">
          Import CSV
        </Link>
      </div>

      <TransactionFiltersComponent
        filters={filters}
        searchInput={searchInput}
        bucketTags={bucketTags}
        occasionTags={occasionTags}
        accountTags={accountTags}
        largeThreshold={largeThreshold}
        onFiltersChange={setFilters}
        onSearchInputChange={setSearchInput}
        onSearch={handleSearch}
      />

      <BulkActionsBar
        selectedIds={bulkSelection.selectedIds}
        transactions={transactions}
        totalCount={totalCount}
        bucketTags={bucketTags}
        occasionTags={occasionTags}
        accountTags={accountTags}
        onToggleAll={() => bulkSelection.toggleAll(transactions)}
        onClearSelection={bulkSelection.clearSelection}
        onApplyTag={handleBulkApplyTag}
      />

      {/* Transactions List */}
      <div className="card">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-theme-muted">
            No transactions found
          </div>
        ) : (
          transactions.map((txn) => (
            <TransactionRow
              key={txn.id}
              transaction={txn}
              isSelected={bulkSelection.isSelected(txn.id)}
              isExpanded={expandedIds.has(txn.id)}
              bucketTags={bucketTags}
              accountTags={accountTags}
              allTags={allTags}
              onToggleSelect={() => bulkSelection.toggle(txn.id)}
              onToggleExpand={() => toggleExpand(txn.id)}
              onBucketChange={handleBucketChange}
              onAccountChange={handleAccountChange}
              onRemoveTag={handleRemoveTag}
              onAddTag={handleAddTag}
              onToggleTransfer={handleToggleTransfer}
              onUnlinkTransfer={handleUnlinkTransfer}
              onSaveNote={handleSaveNote}
              onTransactionsChanged={fetchTransactions}
            />
          ))
        )}

        {/* Infinite scroll trigger */}
        <div ref={loadMoreRef} className="py-4">
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 text-theme-muted">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading more...
            </div>
          )}
          {!hasMore && transactions.length > 0 && (
            <div className="text-center text-theme-muted text-sm">
              All {totalCount.toLocaleString()} transactions loaded
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
