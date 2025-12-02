'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

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
  category: string | null
  reconciliation_status: string
  bucket?: string
}

export default function ReconcilePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [accountTags, setAccountTags] = useState<Tag[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBucketTags()
    fetchAccountTags()
    fetchUnreconciledTransactions()
  }, [])

  async function fetchBucketTags() {
    try {
      const res = await fetch('/api/v1/tags/buckets')
      const data = await res.json()
      setBucketTags(data)
    } catch (error) {
      console.error('Error fetching bucket tags:', error)
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

  async function fetchUnreconciledTransactions() {
    try {
      const res = await fetch('/api/v1/transactions?reconciliation_status=unreconciled&limit=500')
      const data = await res.json()

      // Fetch bucket tags for each transaction
      const transactionsWithBuckets = await Promise.all(
        data.map(async (txn: Transaction) => {
          try {
            const tagsRes = await fetch(`/api/v1/transactions/${txn.id}/tags`)
            const tagsData = await tagsRes.json()
            const tags = tagsData.tags || []
            const bucketTag = tags.find((t: TransactionTag) => t.namespace === 'bucket')
            return { ...txn, bucket: bucketTag?.value || null }
          } catch {
            return { ...txn, bucket: null }
          }
        })
      )

      setTransactions(transactionsWithBuckets)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setLoading(false)
    }
  }

  function toggleSelection(id: number) {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  function toggleAll() {
    if (selected.size === transactions.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(transactions.map(t => t.id)))
    }
  }

  async function bulkUpdate(updates: any) {
    if (selected.size === 0) return

    try {
      await fetch('/api/v1/transactions/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: Array.from(selected),
          ...updates
        })
      })
      setSelected(new Set())
      fetchUnreconciledTransactions()
    } catch (error) {
      console.error('Error updating transactions:', error)
    }
  }

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
          await fetch(`/api/v1/transactions/${txnId}/tags/bucket:${txn.bucket}`, {
            method: 'DELETE'
          })
        }
      }
      fetchUnreconciledTransactions()
    } catch (error) {
      console.error('Error updating transaction bucket:', error)
    }
  }

  async function markReconciled(txnId: number) {
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliation_status: 'matched' })
      })
      fetchUnreconciledTransactions()
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

  async function markIgnored(txnId: number) {
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliation_status: 'ignored' })
      })
      fetchUnreconciledTransactions()
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

  async function markAsTransfer(txnId: number) {
    try {
      // Mark as transfer
      await fetch('/api/v1/transfers/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: [txnId],
          is_transfer: true
        })
      })
      // Also mark as reconciled since transfers are expected
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliation_status: 'matched' })
      })
      fetchUnreconciledTransactions()
    } catch (error) {
      console.error('Error marking as transfer:', error)
    }
  }

  async function bulkMarkAsTransfer() {
    if (selected.size === 0) return
    try {
      // Mark all as transfers
      await fetch('/api/v1/transfers/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_ids: Array.from(selected),
          is_transfer: true
        })
      })
      // Also mark as reconciled
      await bulkUpdate({ reconciliation_status: 'matched' })
    } catch (error) {
      console.error('Error bulk marking as transfers:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="reconcile"
        title="Reconcile Help"
        description="Review and verify imported transactions. Mark them as reconciled once you've confirmed they're correct, or ignore duplicates and internal transfers."
        steps={[
          "Review each unreconciled transaction",
          "Select transactions using the checkboxes",
          "Click 'Mark as Reconciled' for verified transactions",
          "Click 'Ignore' for duplicates or internal transfers"
        ]}
        tips={[
          "Reconciled transactions appear normally in reports",
          "Ignored transactions are hidden from most views",
          "You can change the status later on the Transactions page"
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Reconcile Transactions</h1>
          <p className="mt-2 text-sm text-theme-muted">
            {transactions.length} unreconciled transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => bulkUpdate({ reconciliation_status: 'matched' })}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Mark {selected.size} as Reconciled
          </button>
          <button
            onClick={bulkMarkAsTransfer}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Mark as internal transfer and reconcile"
          >
            Transfer {selected.size}
          </button>
          <button
            onClick={() => bulkUpdate({ reconciliation_status: 'ignored' })}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Ignore {selected.size}
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">All transactions are reconciled!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
          {/* Header row */}
          <div className="px-4 py-3 bg-gray-50 flex items-center gap-4">
            <input
              type="checkbox"
              checked={selected.size === transactions.length}
              onChange={toggleAll}
              className="rounded"
            />
            <span className="text-xs font-medium text-gray-500 uppercase w-24">Date</span>
            <span className="text-xs font-medium text-gray-500 uppercase flex-1">Merchant</span>
            <span className="text-xs font-medium text-gray-500 uppercase w-28 text-right">Amount</span>
            <span className="text-xs font-medium text-gray-500 uppercase w-24 text-center">Actions</span>
          </div>

          {transactions.map((txn) => (
            <div key={txn.id} className={`p-4 hover:bg-gray-50 ${selected.has(txn.id) ? 'bg-blue-50' : ''}`}>
              {/* Line 1: Checkbox, Date, Merchant, Amount, Actions */}
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selected.has(txn.id)}
                  onChange={() => toggleSelection(txn.id)}
                  className="rounded"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap w-24">
                  {format(new Date(txn.date), 'MM/dd/yyyy')}
                </span>
                <span className="font-medium text-gray-900 truncate flex-1">
                  {txn.merchant || 'Unknown'}
                </span>
                <span className={`font-semibold text-lg whitespace-nowrap w-28 text-right ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(txn.amount, true)}
                </span>
                <div className="w-24 text-center flex gap-1 justify-center">
                  <button
                    onClick={() => markReconciled(txn.id)}
                    className="text-green-600 hover:text-green-900"
                    title="Mark as reconciled"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => markAsTransfer(txn.id)}
                    className="text-blue-600 hover:text-blue-900 text-xs font-medium"
                    title="Mark as internal transfer"
                  >
                    T
                  </button>
                  <button
                    onClick={() => markIgnored(txn.id)}
                    className="text-gray-600 hover:text-gray-900"
                    title="Ignore"
                  >
                    ✗
                  </button>
                </div>
              </div>

              {/* Line 2: Description, Bucket, Account */}
              <div className="flex items-center gap-3 mt-1 pl-10 text-sm">
                <span className="text-gray-500 truncate max-w-md">
                  {txn.description}
                </span>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
