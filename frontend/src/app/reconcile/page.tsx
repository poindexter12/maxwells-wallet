'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'

export default function ReconcilePage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUnreconciledTransactions()
  }, [])

  async function fetchUnreconciledTransactions() {
    try {
      const res = await fetch('/api/v1/transactions?reconciliation_status=unreconciled&limit=500')
      const data = await res.json()
      setTransactions(data)
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

  async function handleCategoryChange(txnId: number, newCategory: string) {
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      })
      fetchUnreconciledTransactions()
    } catch (error) {
      console.error('Error updating transaction:', error)
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

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reconcile Transactions</h1>
          <p className="mt-2 text-sm text-gray-600">
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === transactions.length}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((txn) => (
                <tr key={txn.id} className={`hover:bg-gray-50 ${selected.has(txn.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selected.has(txn.id)}
                      onChange={() => toggleSelection(txn.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(txn.date), 'MM/dd/yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {txn.merchant || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {txn.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <select
                      value={txn.category || ''}
                      onChange={(e) => handleCategoryChange(txn.id, e.target.value)}
                      className="text-sm border rounded px-2 py-1 w-full"
                    >
                      <option value="">Uncategorized</option>
                      <option value="Income">Income</option>
                      <option value="Groceries">Groceries</option>
                      <option value="Dining & Coffee">Dining & Coffee</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Transportation">Transportation</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Education">Education</option>
                      <option value="Housing">Housing</option>
                      <option value="Subscriptions">Subscriptions</option>
                      <option value="Other">Other</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {txn.account_source}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(txn.amount, true)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    <button
                      onClick={() => markReconciled(txn.id)}
                      className="text-green-600 hover:text-green-900 mr-2"
                      title="Mark as reconciled"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => markIgnored(txn.id)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Ignore"
                    >
                      ✗
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
