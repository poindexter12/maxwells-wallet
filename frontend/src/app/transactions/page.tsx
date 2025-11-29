'use client'

import { useEffect, useState } from 'react'
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
  category: string | null  // Legacy field
  reconciliation_status: string
  tags?: TransactionTag[]
  bucket?: string  // Convenience field we'll compute
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [accountTags, setAccountTags] = useState<Tag[]>([])
  const [occasionTags, setOccasionTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    bucket: '',
    account: '',
    status: ''
  })
  const [addingTagTo, setAddingTagTo] = useState<number | null>(null)
  const [newTagValue, setNewTagValue] = useState('')

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkAction, setBulkAction] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => {
    fetchBucketTags()
    fetchAllTags()
    fetchAccountTags()
    fetchOccasionTags()
    fetchTransactions()
  }, [])

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

  async function fetchTransactions() {
    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      // Note: Backend still uses category filter for legacy support
      if (filters.bucket) params.append('category', filters.bucket)
      if (filters.account) params.append('account_source', filters.account)
      if (filters.status) params.append('reconciliation_status', filters.status)

      const res = await fetch(`/api/v1/transactions?${params.toString()}&limit=100`)
      const data = await res.json()

      // Fetch tags for each transaction
      const transactionsWithTags = await Promise.all(
        data.map(async (txn: Transaction) => {
          try {
            const tagsRes = await fetch(`/api/v1/transactions/${txn.id}/tags`)
            const tagsData = await tagsRes.json()
            const tags = tagsData.tags || []
            const bucketTag = tags.find((t: TransactionTag) => t.namespace === 'bucket')
            return {
              ...txn,
              tags,
              bucket: bucketTag?.value || null
            }
          } catch {
            return { ...txn, tags: [], bucket: null }
          }
        })
      )

      setTransactions(transactionsWithTags)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setLoading(false)
    }
  }

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

  // Get tags that aren't already on this transaction (excluding bucket namespace)
  function getAvailableTagsForTransaction(txn: Transaction): Tag[] {
    const existingTags = new Set(txn.tags?.map(t => t.full) || [])
    return allTags.filter(t =>
      t.namespace !== 'bucket' &&
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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <Link
          href="/import"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Import CSV
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search merchant or description..."
            className="px-4 py-2 border rounded-md"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onBlur={fetchTransactions}
          />
          <select
            className="px-4 py-2 border rounded-md"
            value={filters.bucket}
            onChange={(e) => {
              setFilters({ ...filters, bucket: e.target.value })
              setTimeout(fetchTransactions, 0)
            }}
          >
            <option value="">All Buckets</option>
            {bucketTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="px-4 py-2 border rounded-md"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value })
              setTimeout(fetchTransactions, 0)
            }}
          >
            <option value="">All Status</option>
            <option value="unreconciled">Unreconciled</option>
            <option value="matched">Matched</option>
            <option value="manually_entered">Manually Entered</option>
            <option value="ignored">Ignored</option>
          </select>
          <button
            onClick={fetchTransactions}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === transactions.length && transactions.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-600">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </span>
          </div>

          {selectedIds.size > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <select
                value={bulkAction}
                onChange={(e) => {
                  setBulkAction(e.target.value)
                  setBulkValue('')
                }}
                className="px-3 py-1.5 border rounded-md text-sm"
              >
                <option value="">Assign to...</option>
                <option value="bucket">Bucket</option>
                <option value="occasion">Occasion</option>
              </select>

              {bulkAction === 'bucket' && (
                <select
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  className="px-3 py-1.5 border rounded-md text-sm"
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
                  className="px-3 py-1.5 border rounded-md text-sm"
                >
                  <option value="">Select occasion...</option>
                  {occasionTags.map((tag) => (
                    <option key={tag.id} value={`occasion:${tag.value}`}>
                      {tag.value.charAt(0).toUpperCase() + tag.value.slice(1).replace(/-/g, ' ')}
                    </option>
                  ))}
                </select>
              )}

              {bulkValue && (
                <button
                  onClick={handleBulkApply}
                  disabled={bulkLoading}
                  className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {bulkLoading ? 'Applying...' : `Apply to ${selectedIds.size}`}
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedIds(new Set())
                  setBulkAction('')
                  setBulkValue('')
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found
          </div>
        ) : (
          transactions.map((txn) => (
            <div key={txn.id} className={`p-4 hover:bg-gray-50 border-b ${selectedIds.has(txn.id) ? 'bg-blue-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">

                {/* LEFT SIDE: checkbox + date + merchant */}
                <div className="flex items-start gap-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(txn.id)}
                    onChange={() => toggleSelect(txn.id)}
                    className="w-4 h-4 mt-1"
                  />

                  <div className="w-24 text-sm text-gray-500 pt-0.5">
                    {format(new Date(txn.date), 'MM/dd/yyyy')}
                  </div>

                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium text-gray-900 truncate">
                      {txn.merchant || 'Unknown'}
                    </span>
                    <span className="text-sm text-gray-500 truncate">
                      {txn.description}
                    </span>
                  </div>
                </div>

                {/* RIGHT SIDE: amount */}
                <div className="text-right">
                  <span className={`font-semibold text-lg ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(txn.amount, true)}
                  </span>
                </div>

              </div>

              {/* FOOTER ROW */}
              <div className="flex items-center gap-3 mt-2 pl-10 flex-wrap">
                <select
                  value={txn.bucket || ''}
                  onChange={(e) => handleBucketChange(txn.id, e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-gray-50"
                >
                  <option value="">No Bucket</option>
                  {bucketTags.map((tag) => (
                    <option key={tag.id} value={tag.value}>
                      {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                    </option>
                  ))}
                </select>

                <span className="text-xs text-gray-400">{getAccountDisplayName(txn.account_source)}</span>

                {/* Non-bucket tags as chips */}
                {txn.tags?.filter(t => t.namespace !== 'bucket').map((tag) => (
                  <span
                    key={tag.full}
                    className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full"
                  >
                    {tag.namespace}:{tag.value}
                    <button
                      onClick={() => handleRemoveTag(txn.id, tag.full)}
                      className="hover:text-purple-900"
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
                      className="text-xs border rounded px-1 py-0.5"
                      autoFocus
                      onBlur={() => { setAddingTagTo(null); setNewTagValue('') }}
                    >
                      <option value="">Select tag...</option>
                      {getAvailableTagsForTransaction(txn).map((tag) => (
                        <option key={tag.id} value={`${tag.namespace}:${tag.value}`}>
                          {tag.namespace}:{tag.value}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => { setAddingTagTo(null); setNewTagValue('') }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTagTo(txn.id)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                    title="Add tag"
                  >
                    + tag
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
