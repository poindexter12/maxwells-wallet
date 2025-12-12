'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { PageHelp } from '@/components/PageHelp'
import { DatePicker } from '@/components/DatePicker'
import { VirtualTransactionList } from '@/components/transactions'
import { TEST_IDS } from '@/test-ids'
import { useFormat } from '@/hooks/useFormat'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch transactions when filters are initialized or change
  useEffect(() => {
    if (filtersInitialized) {
      fetchTransactions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersInitialized, filters]) // Refetch when filters change

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
  async function fetchTransactions() {
    setLoading(true)
    try {
      const params = buildFilterParams()
      params.append('limit', PAGE_SIZE.toString())
      // No cursor for initial fetch

      const res = await fetch(`/api/v1/transactions/paginated?${params.toString()}`)
      const data = await res.json()

      const transactionsWithTags = await fetchTransactionsWithTags(data.items || [])

      setTransactions(transactionsWithTags)
      setNextCursor(data.next_cursor || null)
      setHasMore(data.has_more || false)
      setLoading(false)

      // Also fetch total count
      fetchTotalCount()
    } catch (error) {
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

      {/* Quick Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          {/* Date Range Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-theme-muted font-medium uppercase tracking-wide">{t('filters.date')}</span>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_THIS_MONTH}
              data-chaos-target="txn-quick-this-month"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.thisMonth')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LAST_MONTH}
              data-chaos-target="txn-quick-last-month"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              title={`${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            >
              {t('filters.lastMonth')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_THIS_YEAR}
              data-chaos-target="txn-quick-this-year"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                const lastDay = new Date(now.getFullYear(), 11, 31)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.thisYear')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_YTD}
              data-chaos-target="txn-quick-ytd"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.ytd')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LAST_90_DAYS}
              data-chaos-target="txn-quick-last-90"
              onClick={() => {
                const now = new Date()
                const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                setFilters({
                  ...filters,
                  startDate: past.toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.last90Days')}
            </button>
          </div>

          <div className="h-6 w-px bg-theme hidden sm:block" />

          {/* Insight Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-theme-muted font-medium uppercase tracking-wide">{t('filters.quick')}</span>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LARGE_DYNAMIC}
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                // Use dynamic threshold or fall back to locale-specific default
                const threshold = largeThreshold || getDefaultLargeThreshold()
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0],
                  amountMin: '',
                  amountMax: `-${threshold}`
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors dark:border-orange-700 dark:text-orange-300 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
              title={largeThreshold ? t('filters.largeTitleWithThreshold', { threshold: formatCurrency(largeThreshold) }) : t('filters.largeTitle')}
            >
              ⚠️ {t('filters.largeDynamic', { threshold: formatCurrency(largeThreshold || getDefaultLargeThreshold()) })}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_TOP_SPENDING}
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0],
                  amountMin: '',
                  amountMax: '-50'
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
              title="Top spending this month (over $50)"
            >
              🏪 {t('filters.topSpending')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LARGE}
              onClick={() => {
                const threshold = getDefaultLargeThreshold()
                setFilters({
                  ...filters,
                  amountMin: '',
                  amountMax: `-${threshold}`
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors dark:border-red-700 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50"
              title={t('filters.largeTitle')}
            >
              💰 {t('filters.largeDynamic', { threshold: formatCurrency(getDefaultLargeThreshold()) })}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_UNRECONCILED}
              onClick={() => {
                setFilters({
                  ...filters,
                  status: 'unreconciled'
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50"
              title="Transactions needing review"
            >
              📋 {t('status.unreconciled')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Primary filters row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            data-testid={TEST_IDS.FILTER_SEARCH}
            data-chaos-target="txn-filter-search"
            type="text"
            placeholder={t('searchPlaceholder')}
            className="input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setFilters({ ...filters, search: searchInput })
              }
            }}
          />
          <select
            data-testid={TEST_IDS.FILTER_BUCKET}
            data-chaos-target="txn-filter-bucket"
            className="input"
            value={filters.bucket}
            onChange={(e) => setFilters({ ...filters, bucket: e.target.value })}
          >
            <option value="">{t('allBuckets')}</option>
            {bucketTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
              </option>
            ))}
          </select>
          <select
            data-testid={TEST_IDS.FILTER_OCCASION}
            data-chaos-target="txn-filter-occasion"
            className="input"
            value={filters.occasion}
            onChange={(e) => setFilters({ ...filters, occasion: e.target.value })}
          >
            <option value="">{t('allOccasions')}</option>
            {occasionTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1).replace(/-/g, ' ')}
              </option>
            ))}
          </select>
          <div className="relative">
            <button
              data-testid={TEST_IDS.FILTER_ACCOUNT}
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-full px-4 py-2 border border-theme rounded-md text-left flex justify-between items-center bg-theme-elevated"
            >
              <span className={filters.accounts.length > 0 || filters.accountsExclude.length > 0 ? 'text-theme' : 'text-theme-muted'}>
                {filters.accounts.length > 0
                  ? `${filters.accounts.length} selected`
                  : filters.accountsExclude.length > 0
                    ? `Excluding ${filters.accountsExclude.length}`
                    : t('allAccounts')}
              </span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAccountDropdown && (
              <div className="absolute z-20 mt-1 w-72 bg-theme-elevated border border-theme rounded-md shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-theme text-xs text-theme-muted">
                  {t('filters.clickToInclude')}
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
                      {t('bulk.clearSelection')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, search: searchInput })}
              className="flex-1 btn-primary"
            >
              {tCommon('search')}
            </button>
            <button
              data-testid={TEST_IDS.FILTER_ADVANCED_TOGGLE}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 border border-theme rounded-md ${showAdvancedFilters ? 'bg-[var(--color-bg-hover)]' : ''}`}
              title={t('filters.advanced')}
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
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <select
                data-testid={TEST_IDS.FILTER_STATUS}
                data-chaos-target="txn-filter-status"
                className="input"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">{t('allStatus')}</option>
                <option value="unreconciled">{t('status.unreconciled')}</option>
                <option value="matched">{t('status.matched')}</option>
                <option value="manually_entered">{t('status.manuallyEntered')}</option>
                <option value="ignored">{t('status.ignored')}</option>
              </select>
              <select
                data-testid={TEST_IDS.FILTER_TRANSFERS}
                data-chaos-target="txn-filter-transfers"
                className="input"
                value={filters.transfers}
                onChange={(e) => setFilters({ ...filters, transfers: e.target.value as 'all' | 'hide' | 'only' })}
                title="Filter internal transfers (CC payments, bank transfers)"
              >
                <option value="hide">{t('hideTransfers')}</option>
                <option value="all">{t('showTransfers')}</option>
                <option value="only">{t('transfersOnly')}</option>
              </select>
              <div className="flex gap-2 items-center">
                <input
                  data-testid={TEST_IDS.FILTER_AMOUNT_MIN}
                  data-chaos-target="txn-filter-amount-min"
                  type="number"
                  placeholder={t('minAmount', { defaultValue: 'Min $' })}
                  className="input w-full"
                  value={filters.amountMin}
                  onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                />
                <span className="text-theme-muted">–</span>
                <input
                  data-testid={TEST_IDS.FILTER_AMOUNT_MAX}
                  data-chaos-target="txn-filter-amount-max"
                  type="number"
                  placeholder={t('maxAmount', { defaultValue: 'Max $' })}
                  className="input w-full"
                  value={filters.amountMax}
                  onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                />
              </div>
              <DatePicker
                data-testid={TEST_IDS.FILTER_DATE_START}
                data-chaos-target="txn-filter-date-start"
                className="input"
                value={filters.startDate}
                onChange={(value) => setFilters({ ...filters, startDate: value })}
                title={t('startDate', { defaultValue: 'Start date' })}
              />
              <DatePicker
                data-testid={TEST_IDS.FILTER_DATE_END}
                data-chaos-target="txn-filter-date-end"
                className="input"
                value={filters.endDate}
                onChange={(value) => setFilters({ ...filters, endDate: value })}
                title={t('endDate', { defaultValue: 'End date' })}
              />
              <button
                data-testid={TEST_IDS.FILTER_CLEAR}
                data-chaos-target="txn-filter-clear"
                onClick={() => {
                  setSearchInput('')
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
                    endDate: '',
                    transfers: 'hide'
                  })
                  setShowAccountDropdown(false)
                }}
                className="px-4 py-2 text-theme-muted border border-theme rounded-md hover:bg-[var(--color-bg-hover)]"
              >
                {t('filters.clearAll')}
              </button>
            </div>
          </div>
        )}

        {/* Active filters pills */}
        {(filters.bucket || filters.occasion || filters.accounts.length > 0 || filters.accountsExclude.length > 0 || filters.status || filters.amountMin || filters.amountMax || filters.startDate || filters.endDate || filters.transfers !== 'hide') && (
          <div className="flex flex-wrap gap-2 pt-2">
            {filters.bucket && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {t('bucket')}: {filters.bucket}
                <button onClick={() => setFilters({ ...filters, bucket: '' })} className="hover:text-green-900">×</button>
              </span>
            )}
            {filters.occasion && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                {t('occasion')}: {filters.occasion.replace(/-/g, ' ')}
                <button onClick={() => setFilters({ ...filters, occasion: '' })} className="hover:text-purple-900">×</button>
              </span>
            )}
            {filters.accounts.map(acc => (
              <span key={`inc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {t('account')}: {accountTags.find(t => t.value === acc)?.description || acc}
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
                {tFields('status')}: {filters.status}
                <button onClick={() => setFilters({ ...filters, status: '' })} className="hover:text-yellow-900">×</button>
              </span>
            )}
            {(filters.amountMin || filters.amountMax) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                {tFields('amount')}: {filters.amountMin || '∞'} – {filters.amountMax || '∞'}
                <button onClick={() => setFilters({ ...filters, amountMin: '', amountMax: '' })} className="hover:text-orange-900">×</button>
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                {tFields('date')}: {filters.startDate || '...'} – {filters.endDate || '...'}
                <button onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })} className="hover:text-gray-900">×</button>
              </span>
            )}
            {filters.transfers !== 'hide' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {filters.transfers === 'all' ? t('showTransfers') : t('transfersOnly')}
                <button onClick={() => setFilters({ ...filters, transfers: 'hide' })} className="hover:text-blue-900">×</button>
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
              data-testid={TEST_IDS.BULK_SELECT_ALL}
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
