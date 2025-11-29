'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'

interface OccasionStats {
  id: number
  value: string
  description: string | null
  color: string | null
  sort_order: number
  transaction_count: number
  total_amount: number
}

export default function OccasionsPage() {
  const [occasions, setOccasions] = useState<OccasionStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOccasions()
  }, [])

  async function fetchOccasions() {
    try {
      const res = await fetch('/api/v1/tags/occasions/stats')
      const data = await res.json()
      setOccasions(data.occasions || [])
    } catch (err) {
      console.error('Error fetching occasions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  const totalTransactions = occasions.reduce((sum, o) => sum + o.transaction_count, 0)
  const totalSpending = occasions.reduce((sum, o) => sum + Math.abs(o.total_amount), 0)

  if (loading) {
    return <div className="text-center py-12 text-theme-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Occasions</h1>
          <p className="mt-1 text-sm text-theme-muted">
            Special events and occasions like vacations, holidays, and celebrations
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
          <div className="text-sm text-theme-muted">Total Occasions</div>
          <div className="text-3xl font-bold text-theme">{occasions.length}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Tagged Transactions</div>
          <div className="text-3xl font-bold text-theme">{totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Total Occasion Spending</div>
          <div className="text-3xl font-bold text-negative">{formatCurrency(-totalSpending)}</div>
        </div>
      </div>

      {/* Occasions Grid */}
      {occasions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-theme-muted mb-4">No occasions yet.</p>
          <Link href="/admin" className="text-blue-500 hover:text-blue-400">
            Create occasions in Admin →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {occasions.map((occasion) => (
            <Link
              key={occasion.id}
              href={`/transactions?occasion=${occasion.value}`}
              className="block card p-5 hover:shadow-lg transition-shadow border-l-4"
              style={{ borderLeftColor: occasion.color || '#8b5cf6' }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-theme capitalize text-lg">
                    {occasion.value.replace(/-/g, ' ')}
                  </h3>
                  {occasion.description && (
                    <p className="text-sm text-theme-muted mt-1">{occasion.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-negative">
                    {formatCurrency(occasion.total_amount)}
                  </div>
                  <div className="text-xs text-theme-muted">
                    {occasion.transaction_count} txn{occasion.transaction_count !== 1 ? 's' : ''}
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
                        width: `${Math.min(100, (Math.abs(occasion.total_amount) / totalSpending) * 100)}%`,
                        backgroundColor: occasion.color || '#8b5cf6'
                      }}
                    />
                  </div>
                  <div className="text-xs text-theme-muted mt-1 text-right">
                    {((Math.abs(occasion.total_amount) / totalSpending) * 100).toFixed(1)}% of occasion spending
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
