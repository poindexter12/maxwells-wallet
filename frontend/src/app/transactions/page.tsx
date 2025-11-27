'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    account: '',
    status: ''
  })

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.category) params.append('category', filters.category)
      if (filters.account) params.append('account_source', filters.account)
      if (filters.status) params.append('reconciliation_status', filters.status)

      const res = await fetch(`/api/v1/transactions?${params.toString()}&limit=100`)
      const data = await res.json()
      setTransactions(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setLoading(false)
    }
  }

  async function handleCategoryChange(txnId: number, newCategory: string) {
    try {
      await fetch(`/api/v1/transactions/${txnId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      })
      fetchTransactions()
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
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
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
            value={filters.category}
            onChange={(e) => {
              setFilters({ ...filters, category: e.target.value })
              fetchTransactions()
            }}
          >
            <option value="">All Categories</option>
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
          <select
            className="px-4 py-2 border rounded-md"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value })
              fetchTransactions()
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

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((txn) => (
              <tr key={txn.id} className="hover:bg-gray-50">
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
                    className="text-sm border rounded px-2 py-1"
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
                  {txn.amount >= 0 ? '+' : ''}{txn.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No transactions found
          </div>
        )}
      </div>
    </div>
  )
}
