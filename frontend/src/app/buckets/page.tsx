'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'

interface BucketStats {
  id: number
  value: string
  description: string | null
  color: string | null
  sort_order: number
  transaction_count: number
  total_amount: number
}

export default function BucketsPage() {
  const [buckets, setBuckets] = useState<BucketStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBuckets()
  }, [])

  async function fetchBuckets() {
    try {
      const res = await fetch('/api/v1/tags/buckets/stats')
      const data = await res.json()
      setBuckets(data.buckets || [])
    } catch (err) {
      console.error('Error fetching buckets:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  const totalTransactions = buckets.reduce((sum, b) => sum + b.transaction_count, 0)
  const totalSpending = buckets.reduce((sum, b) => sum + Math.abs(b.total_amount), 0)

  if (loading) {
    return <div className="text-center py-12 text-theme-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Buckets</h1>
          <p className="mt-1 text-sm text-theme-muted">
            Spending categories for organizing your transactions
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 text-theme-muted border border-theme rounded-md hover:bg-theme-elevated"
        >
          Manage in Admin →
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Total Buckets</div>
          <div className="text-3xl font-bold text-theme">{buckets.length}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Tagged Transactions</div>
          <div className="text-3xl font-bold text-theme">{totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Total Categorized</div>
          <div className="text-3xl font-bold text-negative">{formatCurrency(-totalSpending)}</div>
        </div>
      </div>

      {/* Buckets Grid */}
      {buckets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-theme-muted mb-4">No buckets yet.</p>
          <Link href="/admin" className="text-blue-500 hover:text-blue-400">
            Create buckets in Admin →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buckets.map((bucket) => (
            <Link
              key={bucket.id}
              href={`/transactions?bucket=${bucket.value}`}
              className="block card p-5 hover:shadow-lg transition-shadow border-l-4"
              style={{ borderLeftColor: bucket.color || '#9ca3af' }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-theme capitalize text-lg">
                    {bucket.value.replace(/-/g, ' ')}
                  </h3>
                  {bucket.description && (
                    <p className="text-sm text-theme-muted mt-1">{bucket.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-negative">
                    {formatCurrency(bucket.total_amount)}
                  </div>
                  <div className="text-xs text-theme-muted">
                    {bucket.transaction_count} txn{bucket.transaction_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Progress bar showing % of total spending */}
              {totalSpending > 0 && (
                <div className="mt-4">
                  <div className="h-2 progress-bar rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (Math.abs(bucket.total_amount) / totalSpending) * 100)}%`,
                        backgroundColor: bucket.color || '#6b7280'
                      }}
                    />
                  </div>
                  <div className="text-xs text-theme-muted mt-1 text-right">
                    {((Math.abs(bucket.total_amount) / totalSpending) * 100).toFixed(1)}% of spending
                  </div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
