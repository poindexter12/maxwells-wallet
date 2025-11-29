'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'

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
}

const PAGE_SIZE = 50

// Bucket color mapping for left border
const BUCKET_COLORS: Record<string, string> = {
  'groceries': 'border-l-green-500',
  'dining': 'border-l-orange-500',
  'entertainment': 'border-l-purple-500',
  'transportation': 'border-l-blue-500',
  'utilities': 'border-l-yellow-500',
  'housing': 'border-l-indigo-500',
  'healthcare': 'border-l-red-500',
  'shopping': 'border-l-pink-500',
  'subscriptions': 'border-l-cyan-500',
  'education': 'border-l-teal-500',
  'income': 'border-l-emerald-500',
  'other': 'border-l-gray-400',
  'none': 'border-l-gray-300',
}

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

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [accountTags, setAccountTags] = useState<Tag[]>([])
  const [occasionTags, setOccasionTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
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
    endDate: ''
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [addingTagTo, setAddingTagTo] = useState<number | null>(null)
  const [newTagValue, setNewTagValue] = useState('')

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

  // Infinite scroll refs
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  // Initialize filters from URL params on mount
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

    // Combine single account with multi-accounts
    const accounts = accountSingle
      ? [accountSingle, ...accountsMulti]
      : accountsMulti

    // Check if we have any advanced filters in URL
    const hasAdvanced = status || amountMin || amountMax || startDate || endDate || accountsExclude.length > 0
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
      endDate
    })
    setFiltersInitialized(true)
  }, [searchParams])

  // Fetch tags on mount
  useEffect(() => {
    fetchBucketTags()
    fetchAllTags()
    fetchAccountTags()
    fetchOccasionTags()
  }, [])

  // Fetch transactions when filters are initialized or change
  useEffect(() => {
    if (filtersInitialized) {
      fetchTransactions()
    }
  }, [filtersInitialized, filters])

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

  function getAccountDisplayName(accountSource: string): string {
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

  // Initial fetch (resets list)
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

      // Also fetch total count
      fetchTotalCount()
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setLoading(false)
    }
  }

  // Load more transactions (append to list)
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

  // Get bucket border color
  function getBucketBorderColor(bucket: string | null | undefined): string {
    if (!bucket) return 'border-l-gray-200'
    return BUCKET_COLORS[bucket.toLowerCase()] || 'border-l-gray-400'
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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Transactions</h1>
          {totalCount > 0 && (
            <p className="text-sm text-theme-muted mt-1">
              Showing {transactions.length.toLocaleString()} of {totalCount.toLocaleString()} transactions
            </p>
          )}
        </div>
        <Link
          href="/import"
          className="btn-primary"
        >
          Import CSV
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Primary filters row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Search merchant or description..."
            className="input"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && fetchTransactions()}
          />
          <select
            className="input"
            value={filters.bucket}
            onChange={(e) => setFilters({ ...filters, bucket: e.target.value })}
          >
            <option value="">All Buckets</option>
            {bucketTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filters.occasion}
            onChange={(e) => setFilters({ ...filters, occasion: e.target.value })}
          >
            <option value="">All Occasions</option>
            {occasionTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1).replace(/-/g, ' ')}
              </option>
            ))}
          </select>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-full px-4 py-2 border border-theme rounded-md text-left flex justify-between items-center bg-theme-elevated"
            >
              <span className={filters.accounts.length > 0 || filters.accountsExclude.length > 0 ? 'text-theme' : 'text-theme-muted'}>
                {filters.accounts.length > 0
                  ? `${filters.accounts.length} selected`
                  : filters.accountsExclude.length > 0
                    ? `Excluding ${filters.accountsExclude.length}`
                    : 'All Accounts'}
              </span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAccountDropdown && (
              <div className="absolute z-20 mt-1 w-72 bg-theme-elevated border border-theme rounded-md shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-theme text-xs text-theme-muted">
                  Click to include, Shift+Click to exclude
                </div>
                {accountTags.map((tag) => {
                  const isIncluded = filters.accounts.includes(tag.value)
                  const isExcluded = filters.accountsExclude.includes(tag.value)
                  return (
                    <div
                      key={tag.id}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          // Toggle exclude
                          if (isExcluded) {
                            setFilters({
                              ...filters,
                              accountsExclude: filters.accountsExclude.filter(a => a !== tag.value)
                            })
                          } else {
                            setFilters({
                              ...filters,
                              accounts: filters.accounts.filter(a => a !== tag.value),
                              accountsExclude: [...filters.accountsExclude, tag.value]
                            })
                          }
                        } else {
                          // Toggle include
                          if (isIncluded) {
                            setFilters({
                              ...filters,
                              accounts: filters.accounts.filter(a => a !== tag.value)
                            })
                          } else {
                            setFilters({
                              ...filters,
                              accounts: [...filters.accounts, tag.value],
                              accountsExclude: filters.accountsExclude.filter(a => a !== tag.value)
                            })
                          }
                        }
                      }}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                        isIncluded ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' :
                        isExcluded ? 'bg-negative text-negative' :
                        'hover:bg-[var(--color-bg-hover)]'
                      }`}
                    >
                      <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${
                        isIncluded ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' :
                        isExcluded ? 'bg-[var(--color-negative)] border-[var(--color-negative)] text-white' :
                        'border-theme'
                      }`}>
                        {isIncluded && '✓'}
                        {isExcluded && '−'}
                      </span>
                      <span>{tag.description || tag.value}</span>
                    </div>
                  )
                })}
                {(filters.accounts.length > 0 || filters.accountsExclude.length > 0) && (
                  <div className="p-2 border-t border-theme">
                    <button
                      onClick={() => setFilters({ ...filters, accounts: [], accountsExclude: [] })}
                      className="text-xs text-theme-muted hover:text-theme"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchTransactions}
              className="flex-1 btn-primary"
            >
              Search
            </button>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 border border-theme rounded-md ${showAdvancedFilters ? 'bg-[var(--color-bg-hover)]' : ''}`}
              title="Advanced filters"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced filters (collapsible) */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-theme">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Status</option>
                <option value="unreconciled">Unreconciled</option>
                <option value="matched">Matched</option>
                <option value="manually_entered">Manually Entered</option>
                <option value="ignored">Ignored</option>
              </select>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder="Min $"
                  className="input w-full"
                  value={filters.amountMin}
                  onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                />
                <span className="text-theme-muted">–</span>
                <input
                  type="number"
                  placeholder="Max $"
                  className="input w-full"
                  value={filters.amountMax}
                  onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                />
              </div>
              <input
                type="date"
                className="input"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                title="Start date"
              />
              <input
                type="date"
                className="input"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                title="End date"
              />
              <button
                onClick={() => {
                  setFilters({
                    search: '',
                    bucket: '',
                    occasion: '',
                    accounts: [],
                    accountsExclude: [],
                    status: '',
                    amountMin: '',
                    amountMax: '',
                    startDate: '',
                    endDate: ''
                  })
                  setShowAccountDropdown(false)
                }}
                className="px-4 py-2 text-theme-muted border border-theme rounded-md hover:bg-[var(--color-bg-hover)]"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Active filters pills */}
        {(filters.bucket || filters.occasion || filters.accounts.length > 0 || filters.accountsExclude.length > 0 || filters.status || filters.amountMin || filters.amountMax || filters.startDate || filters.endDate) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {filters.bucket && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                Bucket: {filters.bucket}
                <button onClick={() => setFilters({ ...filters, bucket: '' })} className="hover:text-green-900">×</button>
              </span>
            )}
            {filters.occasion && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                Occasion: {filters.occasion.replace(/-/g, ' ')}
                <button onClick={() => setFilters({ ...filters, occasion: '' })} className="hover:text-purple-900">×</button>
              </span>
            )}
            {filters.accounts.map(acc => (
              <span key={`inc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                Account: {accountTags.find(t => t.value === acc)?.description || acc}
                <button onClick={() => setFilters({ ...filters, accounts: filters.accounts.filter(a => a !== acc) })} className="hover:text-blue-900">×</button>
              </span>
            ))}
            {filters.accountsExclude.map(acc => (
              <span key={`exc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                NOT: {accountTags.find(t => t.value === acc)?.description || acc}
                <button onClick={() => setFilters({ ...filters, accountsExclude: filters.accountsExclude.filter(a => a !== acc) })} className="hover:text-red-900">×</button>
              </span>
            ))}
            {filters.status && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                Status: {filters.status}
                <button onClick={() => setFilters({ ...filters, status: '' })} className="hover:text-yellow-900">×</button>
              </span>
            )}
            {(filters.amountMin || filters.amountMax) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                Amount: {filters.amountMin || '∞'} – {filters.amountMax || '∞'}
                <button onClick={() => setFilters({ ...filters, amountMin: '', amountMax: '' })} className="hover:text-orange-900">×</button>
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                Date: {filters.startDate || '...'} – {filters.endDate || '...'}
                <button onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })} className="hover:text-gray-900">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions Bar - Sticky when items selected */}
      <div className={`rounded-lg shadow p-4 transition-all duration-200 ${
        selectedIds.size > 0
          ? 'bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]/30 sticky top-0 z-10'
          : 'card'
      }`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === transactions.length && transactions.length > 0}
              ref={el => {
                if (el) {
                  el.indeterminate = selectedIds.size > 0 && selectedIds.size < transactions.length
                }
              }}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded"
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
                onClick={() => {
                  setSelectedIds(new Set())
                  setBulkAction('')
                  setBulkValue('')
                }}
                className="ml-auto text-sm text-[var(--color-accent)] hover:opacity-80 font-medium"
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="card">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-theme-muted">
            No transactions found
          </div>
        ) : (
          transactions.map((txn) => (
            <div
              key={txn.id}
              className={`
                border-l-4 ${getBucketBorderColor(txn.bucket)}
                border-b border-theme
                transition-all duration-150 ease-in-out
                text-sm
                ${selectedIds.has(txn.id)
                  ? 'bg-[var(--color-accent)]/10'
                  : 'hover:bg-[var(--color-bg-hover)]'
                }
              `}
            >
              {/* DESKTOP: Compact table-style grid */}
              <div className="hidden md:block px-4 py-2">
                {/* Top row: checkbox, date, merchant, bucket, account, amount */}
                <div
                  className="grid grid-cols-[auto_5.5rem_minmax(0,1fr)_auto_auto_auto] gap-x-3 items-start"
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(txn.id)}
                    onChange={() => toggleSelect(txn.id)}
                    className="w-4 h-4 rounded mt-0.5"
                  />

                  {/* Date */}
                  <span className="text-xs text-theme-muted pt-0.5">
                    {format(new Date(txn.date), 'MM/dd/yyyy')}
                  </span>

                  {/* Merchant + description */}
                  <div className="min-w-0">
                    <p className="font-medium text-theme truncate">
                      {txn.merchant || 'Unknown'}
                    </p>
                    {txn.description !== txn.merchant && (
                      <p className="text-xs text-theme-muted truncate">
                        {txn.description}
                      </p>
                    )}
                  </div>

                  {/* Bucket */}
                  <select
                    value={txn.bucket || ''}
                    onChange={(e) => handleBucketChange(txn.id, e.target.value)}
                    className="h-7 rounded border border-theme px-2 text-xs bg-theme-elevated"
                  >
                    <option value="">No Bucket</option>
                    {bucketTags.map((tag) => (
                      <option key={tag.id} value={tag.value}>
                        {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                      </option>
                    ))}
                  </select>

                  {/* Account */}
                  <select
                    value={txn.account || ''}
                    onChange={(e) => handleAccountChange(txn.id, e.target.value)}
                    className="h-7 rounded border border-theme px-2 text-xs bg-theme-elevated"
                  >
                    <option value="">No Account</option>
                    {accountTags.map((tag) => (
                      <option key={tag.id} value={tag.value}>
                        {tag.description || tag.value}
                      </option>
                    ))}
                  </select>

                  {/* Amount + expand caret */}
                  <div className="flex items-center gap-1">
                    <span className={`font-semibold text-sm ${txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {formatCurrency(txn.amount, true)}
                    </span>
                    <button
                      onClick={() => toggleExpand(txn.id)}
                      className="text-theme-muted hover:text-theme p-0.5"
                      title={expandedIds.has(txn.id) ? 'Collapse' : 'Expand'}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${expandedIds.has(txn.id) ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Tags row: aligned under bucket column, expands to the right */}
                <div
                  className="grid grid-cols-[auto_5.5rem_minmax(0,1fr)_1fr] gap-x-3 mt-1"
                >
                  {/* Empty spacers for checkbox and date columns */}
                  <div></div>
                  <div></div>
                  <div></div>

                  {/* Tags - aligned under bucket, expands right */}
                  <div className="flex flex-wrap items-center gap-1">
                    {/* Notes indicator */}
                    {txn.notes && !expandedIds.has(txn.id) && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full" title={txn.notes}>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}

                    {/* Non-bucket, non-account tags as chips */}
                    {txn.tags?.filter(t => t.namespace !== 'bucket' && t.namespace !== 'account').map((tag) => (
                      <span
                        key={tag.full}
                        className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700"
                        title={`${tag.namespace}:${tag.value}`}
                      >
                        {tag.value}
                        <button
                          onClick={() => handleRemoveTag(txn.id, tag.full)}
                          className="hover:text-purple-900 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    {/* Add tag button */}
                    {addingTagTo === txn.id ? (
                      <div className="inline-flex items-center gap-1">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddTag(txn.id, e.target.value)
                            }
                          }}
                          className="text-xs border rounded px-1 py-0.5 bg-theme-elevated"
                          autoFocus
                          onBlur={() => { setAddingTagTo(null); setNewTagValue('') }}
                        >
                          <option value="">Select...</option>
                          {getAvailableTagsForTransaction(txn).map((tag) => (
                            <option key={tag.id} value={`${tag.namespace}:${tag.value}`}>
                              {tag.namespace}:{tag.value}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setAddingTagTo(null); setNewTagValue('') }}
                          className="text-xs text-theme-muted hover:text-theme"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingTagTo(txn.id)}
                        className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap"
                        title="Add tag"
                      >
                        + tag
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* MOBILE: Card-style layout */}
              <div className="md:hidden px-4 py-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(txn.id)}
                    onChange={() => toggleSelect(txn.id)}
                    className="w-4 h-4 mt-1 rounded"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-theme truncate">
                          {txn.merchant || 'Unknown'}
                        </p>
                        <p className="text-xs text-theme-muted">
                          {format(new Date(txn.date), 'MM/dd/yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`font-semibold ${txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {formatCurrency(txn.amount, true)}
                        </span>
                        <button
                          onClick={() => toggleExpand(txn.id)}
                          className="text-theme-muted hover:text-theme p-0.5"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${expandedIds.has(txn.id) ? 'rotate-180' : ''}`}
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
                        onChange={(e) => handleBucketChange(txn.id, e.target.value)}
                        className="h-7 rounded border border-theme px-2 text-xs bg-theme-elevated"
                      >
                        <option value="">Bucket</option>
                        {bucketTags.map((tag) => (
                          <option key={tag.id} value={tag.value}>
                            {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                          </option>
                        ))}
                      </select>

                      <select
                        value={txn.account || ''}
                        onChange={(e) => handleAccountChange(txn.id, e.target.value)}
                        className="h-7 rounded border border-theme px-2 text-xs bg-theme-elevated"
                      >
                        <option value="">Account</option>
                        {accountTags.map((tag) => (
                          <option key={tag.id} value={tag.value}>
                            {tag.description || tag.value}
                          </option>
                        ))}
                      </select>

                      {/* Tags */}
                      {txn.tags?.filter(t => t.namespace !== 'bucket' && t.namespace !== 'account').map((tag) => (
                        <span
                          key={tag.full}
                          className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700"
                        >
                          {tag.value}
                          <button onClick={() => handleRemoveTag(txn.id, tag.full)} className="hover:text-purple-900">×</button>
                        </span>
                      ))}

                      <button
                        onClick={() => setAddingTagTo(txn.id)}
                        className="text-xs text-blue-500 hover:text-blue-700"
                      >
                        + tag
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* EXPANDED METADATA SECTION */}
              {expandedIds.has(txn.id) && (
                <div className="px-4 pb-4 pt-2 md:pl-12 border-t border-theme bg-[var(--color-bg-hover)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    {/* Left column: metadata */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <span className="text-theme-muted w-24">Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          txn.reconciliation_status === 'matched' ? 'bg-green-100 text-green-800' :
                          txn.reconciliation_status === 'ignored' ? 'bg-gray-100 text-gray-600' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {txn.reconciliation_status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-theme-muted w-24">Description:</span>
                        <span className="text-theme">{txn.description}</span>
                      </div>
                      {txn.account_source && (
                        <div className="flex gap-2">
                          <span className="text-theme-muted w-24">Source:</span>
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
                    </div>

                    {/* Right column: notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-theme-muted">Notes:</span>
                        {editingNoteId !== txn.id && (
                          <button
                            onClick={() => startEditNote(txn)}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            {txn.notes ? 'Edit' : 'Add note'}
                          </button>
                        )}
                      </div>
                      {editingNoteId === txn.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-theme rounded resize-none bg-theme-elevated"
                            rows={2}
                            placeholder="Add a note..."
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveNote(txn.id)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingNoteId(null); setNoteValue('') }}
                              className="px-2 py-1 text-xs text-theme-muted hover:text-theme"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-sm ${txn.notes ? 'text-theme' : 'text-theme-muted italic'}`}>
                          {txn.notes || 'No notes'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
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
