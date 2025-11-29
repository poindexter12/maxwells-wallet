'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

interface AccountStats {
  id: number
  value: string
  description: string | null
  color: string | null
  sort_order: number
  transaction_count: number
  total_amount: number
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/v1/tags/accounts/stats')
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch (err) {
      console.error('Error fetching accounts:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate totals
  const totalTransactions = accounts.reduce((sum, a) => sum + a.transaction_count, 0)
  const totalNet = accounts.reduce((sum, a) => sum + a.total_amount, 0)

  if (loading) {
    return <div className="text-center py-12 text-theme-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="accounts"
        title="Accounts Help"
        description="View all your bank accounts and credit cards in one place. Accounts are automatically created when you import transactions from a new source."
        steps={[
          "Click any account card to see its transactions",
          "Use the Admin page to rename accounts or add descriptions",
          "Filter by account on the Transactions page to focus on one source"
        ]}
        tips={[
          "Accounts are auto-detected from your CSV imports",
          "Give accounts friendly names in Admin to make them easier to identify"
        ]}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Accounts</h1>
          <p className="mt-1 text-sm text-theme-muted">
            Bank accounts and credit cards. Accounts are auto-created when you import transactions.
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
          <div className="text-sm text-theme-muted">Total Accounts</div>
          <div className="text-3xl font-bold text-theme">{accounts.length}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Total Transactions</div>
          <div className="text-3xl font-bold text-theme">{totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm text-theme-muted">Net Flow</div>
          <div className={`text-3xl font-bold ${totalNet >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatCurrency(totalNet)}
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-theme-muted mb-4">No accounts yet. Import some transactions to create accounts automatically!</p>
          <Link href="/import" className="text-blue-500 hover:text-blue-400">
            Import transactions →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/transactions?accounts=${account.value}`}
              className="block card p-5 hover:shadow-lg transition-shadow border-l-4"
              style={{ borderLeftColor: account.color || '#3b82f6' }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-theme text-lg">
                    {account.description || account.value}
                  </h3>
                  <p className="text-xs text-theme-muted font-mono mt-1">{account.value}</p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${account.total_amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatCurrency(account.total_amount)}
                  </div>
                  <div className="text-xs text-theme-muted">
                    {account.transaction_count} txn{account.transaction_count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Activity bar showing relative transaction count */}
              {totalTransactions > 0 && (
                <div className="mt-4">
                  <div className="h-2 progress-bar rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (account.transaction_count / totalTransactions) * 100)}%`,
                        backgroundColor: account.color || '#3b82f6'
                      }}
                    />
                  </div>
                  <div className="text-xs text-theme-muted mt-1 text-right">
                    {((account.transaction_count / totalTransactions) * 100).toFixed(1)}% of transactions
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
