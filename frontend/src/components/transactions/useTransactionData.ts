import { useState, useEffect, useCallback, useRef } from 'react'

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
  account_tag_id: number | null
  category: string | null
  reconciliation_status: string
  notes?: string | null
  tags?: TransactionTag[]
  bucket?: string
  account?: string
  is_transfer?: boolean
  linked_transaction_id?: number | null
}

interface FilterState {
  search: string
  bucket: string
  occasion: string
  accounts: string[]
  accountsExclude: string[]
  status: string
  amountMin: string
  amountMax: string
  startDate: string
  endDate: string
  transfers: 'all' | 'hide' | 'only'
}

interface UseTransactionDataProps {
  filters: FilterState
  filtersInitialized: boolean
  debouncedFilters: string
}

const PAGE_SIZE = 50

export function useTransactionData({
  filters,
  filtersInitialized,
  debouncedFilters,
}: UseTransactionDataProps) {
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

  const abortControllerRef = useRef<AbortController | null>(null)

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

  // Fetch tags on mount
  useEffect(() => {
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

    fetchBucketTags()
    fetchAllTags()
    fetchAccountTags()
    fetchOccasionTags()
  }, [])

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

  return {
    transactions,
    setTransactions,
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
  }
}
