'use client'

import { formatCurrency } from '@/lib/format'
import { PreviewTransaction } from '@/types/customFormat'

interface PreviewTableProps {
  transactions: PreviewTransaction[]
  errors: string[]
  onHide: () => void
}

export function PreviewTable({ transactions, errors, onHide }: PreviewTableProps) {
  if (transactions.length === 0) return null

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-theme">
          Preview: {transactions.length} transactions
        </h3>
        <button
          onClick={onHide}
          className="text-sm text-theme-muted hover:text-theme"
        >
          Hide
        </button>
      </div>

      {errors.length > 0 && (
        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-300">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-theme-elevated">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Merchant</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 5).map((txn, i) => (
              <tr key={i} className="border-t border-theme">
                <td className="px-3 py-2">{txn.date}</td>
                <td className="px-3 py-2">{txn.merchant}</td>
                <td className="px-3 py-2 truncate max-w-[200px]">{txn.description}</td>
                <td className={`px-3 py-2 text-right ${txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(txn.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length > 5 && (
          <p className="px-3 py-2 text-sm text-theme-muted">
            + {transactions.length - 5} more transactions
          </p>
        )}
      </div>
    </div>
  )
}
