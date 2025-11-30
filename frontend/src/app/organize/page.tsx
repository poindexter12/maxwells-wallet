'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'

type OrganizeTab = 'buckets' | 'occasions' | 'accounts'

interface TagStats {
  id: number
  value: string
  description: string | null
  color: string | null
  sort_order: number
  transaction_count: number
  total_amount: number
}

export default function OrganizePage() {
  const [activeTab, setActiveTab] = useState<OrganizeTab>('buckets')
  const [buckets, setBuckets] = useState<TagStats[]>([])
  const [occasions, setOccasions] = useState<TagStats[]>([])
  const [accounts, setAccounts] = useState<TagStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllData()
  }, [])

  async function fetchAllData() {
    try {
      const [bucketsRes, occasionsRes, accountsRes] = await Promise.all([
        fetch('/api/v1/tags/buckets/stats'),
        fetch('/api/v1/tags/occasions/stats'),
        fetch('/api/v1/tags/accounts/stats')
      ])
      const bucketsData = await bucketsRes.json()
      const occasionsData = await occasionsRes.json()
      const accountsData = await accountsRes.json()

      setBuckets(bucketsData.buckets || [])
      setOccasions(occasionsData.occasions || [])
      setAccounts(accountsData.accounts || [])
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'buckets' as const, label: 'Buckets', count: buckets.length },
    { id: 'occasions' as const, label: 'Occasions', count: occasions.length },
    { id: 'accounts' as const, label: 'Accounts', count: accounts.length },
  ]

  if (loading) {
    return <div className="text-center py-12 text-theme-muted">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">Organize</h1>
          <p className="mt-1 text-sm text-theme-muted">
            Buckets, occasions, and accounts for categorizing transactions
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 text-sm text-theme-muted border border-theme rounded-md hover:bg-theme-elevated"
        >
          Manage in Admin
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Buckets Tab */}
      {activeTab === 'buckets' && (
        <BucketsContent buckets={buckets} />
      )}

      {/* Occasions Tab */}
      {activeTab === 'occasions' && (
        <OccasionsContent occasions={occasions} />
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <AccountsContent accounts={accounts} />
      )}
    </div>
  )
}

function BucketsContent({ buckets }: { buckets: TagStats[] }) {
  const totalTransactions = buckets.reduce((sum, b) => sum + b.transaction_count, 0)
  const totalSpending = buckets.reduce((sum, b) => sum + Math.abs(b.total_amount), 0)

  return (
    <div className="space-y-6">
      <p className="text-sm text-theme-muted">
        Spending categories like groceries, dining, entertainment
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Total Buckets</div>
          <div className="text-2xl font-bold text-theme">{buckets.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Tagged Transactions</div>
          <div className="text-2xl font-bold text-theme">{totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Total Categorized</div>
          <div className="text-2xl font-bold text-negative">{formatCurrency(-totalSpending)}</div>
        </div>
      </div>

      {/* Grid */}
      {buckets.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-theme-muted">No buckets yet. Create buckets in Admin.</p>
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

function OccasionsContent({ occasions }: { occasions: TagStats[] }) {
  const totalTransactions = occasions.reduce((sum, o) => sum + o.transaction_count, 0)
  const totalSpending = occasions.reduce((sum, o) => sum + Math.abs(o.total_amount), 0)

  return (
    <div className="space-y-6">
      <p className="text-sm text-theme-muted">
        Special events like vacations, holidays, weddings, or projects
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Total Occasions</div>
          <div className="text-2xl font-bold text-theme">{occasions.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Tagged Transactions</div>
          <div className="text-2xl font-bold text-theme">{totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Total Occasion Spending</div>
          <div className="text-2xl font-bold text-negative">{formatCurrency(-totalSpending)}</div>
        </div>
      </div>

      {/* Grid */}
      {occasions.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-theme-muted">No occasions yet. Create occasions in Admin.</p>
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

function AccountsContent({ accounts }: { accounts: TagStats[] }) {
  const totalTransactions = accounts.reduce((sum, a) => sum + a.transaction_count, 0)
  const totalNet = accounts.reduce((sum, a) => sum + a.total_amount, 0)

  return (
    <div className="space-y-6">
      <p className="text-sm text-theme-muted">
        Bank accounts and credit cards. Auto-created when you import transactions.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Total Accounts</div>
          <div className="text-2xl font-bold text-theme">{accounts.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Total Transactions</div>
          <div className="text-2xl font-bold text-theme">{totalTransactions.toLocaleString()}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-theme-muted">Net Flow</div>
          <div className={`text-2xl font-bold ${totalNet >= 0 ? 'text-positive' : 'text-negative'}`}>
            {formatCurrency(totalNet)}
          </div>
        </div>
      </div>

      {/* Grid */}
      {accounts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-theme-muted mb-4">No accounts yet. Import transactions to create accounts automatically.</p>
          <Link href="/import" className="text-blue-500 hover:text-blue-400">
            Import transactions
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
