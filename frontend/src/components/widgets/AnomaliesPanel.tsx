'use client'

import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import { AnomaliesData } from './types'

interface AnomaliesPanelProps {
  anomalies: AnomaliesData | null
  selectedYear: number
  selectedMonth: number
}

export function AnomaliesPanel({ anomalies, selectedYear, selectedMonth }: AnomaliesPanelProps) {
  if (!anomalies) return null

  const monthStr = String(selectedMonth).padStart(2, '0')
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate()
  const dateRange = `start_date=${selectedYear}-${monthStr}-01&end_date=${selectedYear}-${monthStr}-${lastDay}`

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">Unusual Activity</h2>
      {anomalies.summary.total_anomalies === 0 ? (
        <p className="text-theme-muted text-center py-8">No unusual activity detected</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Link
              href={`/transactions?amount_max=-${anomalies.summary.large_threshold_amount || 100}&${dateRange}`}
              className="bg-negative rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
              title={anomalies.summary.large_threshold_amount ? `Transactions over $${Math.round(anomalies.summary.large_threshold_amount)} (2σ above average)` : 'Large transactions'}
            >
              <p className="text-2xl font-bold text-negative">{anomalies.summary.large_transaction_count}</p>
              <p className="text-xs text-theme-muted">Large</p>
            </Link>
            <Link
              href={`/transactions?${dateRange}`}
              className="bg-blue-500/20 rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
              title="View transactions from new merchants"
            >
              <p className="text-2xl font-bold text-blue-500">{anomalies.summary.new_merchant_count}</p>
              <p className="text-xs text-theme-muted">New</p>
            </Link>
            <Link
              href={`/transactions?${dateRange}`}
              className="bg-orange-500/20 rounded p-2 hover:opacity-80 transition-opacity cursor-pointer"
              title="View buckets with unusually high spending"
            >
              <p className="text-2xl font-bold text-orange-500">{anomalies.summary.unusual_bucket_count}</p>
              <p className="text-xs text-theme-muted">Over Avg</p>
            </Link>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {anomalies.anomalies.large_transactions.slice(0, 3).map((txn, idx) => (
              <Link
                key={`large-${idx}`}
                href={`/transactions?search=${encodeURIComponent(txn.merchant || '')}&${dateRange}`}
                className="block border-l-4 border-red-500 pl-3 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <p className="text-sm font-medium text-theme">{formatCurrency(txn.amount)} - {txn.merchant}</p>
                <p className="text-xs text-theme-muted">{txn.reason}</p>
              </Link>
            ))}
            {anomalies.anomalies.new_merchants.slice(0, 3).map((txn, idx) => (
              <Link
                key={`new-${idx}`}
                href={`/transactions?search=${encodeURIComponent(txn.merchant || '')}&${dateRange}`}
                className="block border-l-4 border-blue-500 pl-3 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <p className="text-sm font-medium text-theme">{formatCurrency(txn.amount)} - {txn.merchant}</p>
                <p className="text-xs text-theme-muted">{txn.reason}</p>
              </Link>
            ))}
            {anomalies.anomalies.unusual_buckets.slice(0, 2).map((bucket, idx) => (
              <Link
                key={`bucket-${idx}`}
                href={`/transactions?bucket=${encodeURIComponent(bucket.bucket || '')}&${dateRange}`}
                className="block border-l-4 border-orange-500 pl-3 py-1 hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <p className="text-sm font-medium text-theme">{bucket.bucket}</p>
                <p className="text-xs text-theme-muted">{bucket.reason}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
