'use client'

import { useState } from 'react'
import { Tag, TransactionFilters as FilterState, INITIAL_FILTERS } from '@/types/transactions'

interface TransactionFiltersProps {
  filters: FilterState
  searchInput: string
  bucketTags: Tag[]
  occasionTags: Tag[]
  accountTags: Tag[]
  largeThreshold: number | null
  onFiltersChange: (filters: FilterState) => void
  onSearchInputChange: (value: string) => void
  onSearch: () => void
}

export default function TransactionFiltersComponent({
  filters,
  searchInput,
  bucketTags,
  occasionTags,
  accountTags,
  largeThreshold,
  onFiltersChange,
  onSearchInputChange,
  onSearch,
}: TransactionFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  // Check if we have any advanced filters active
  const hasAdvancedFilters = filters.status ||
    filters.amountMin ||
    filters.amountMax ||
    filters.startDate ||
    filters.endDate ||
    filters.accountsExclude.length > 0 ||
    filters.transfers !== 'hide'

  function handleQuickDate(startDate: string, endDate: string) {
    onFiltersChange({ ...filters, startDate, endDate })
    setShowAdvanced(true)
  }

  function clearAllFilters() {
    onSearchInputChange('')
    onFiltersChange(INITIAL_FILTERS)
    setShowAccountDropdown(false)
  }

  return (
    <>
      {/* Quick Filters */}
      <div className="card p-4" data-testid="quick-filters">
        <div className="flex flex-wrap gap-4">
          {/* Date Range Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-theme-muted font-medium uppercase tracking-wide">Date:</span>
            <button
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                handleQuickDate(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              data-testid="quick-filter-this-month"
            >
              This Month
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
                handleQuickDate(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              title={`${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
              data-testid="quick-filter-last-month"
            >
              Last Month
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                const lastDay = new Date(now.getFullYear(), 11, 31)
                handleQuickDate(firstDay.toISOString().split('T')[0], lastDay.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              data-testid="quick-filter-this-year"
            >
              This Year
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                handleQuickDate(firstDay.toISOString().split('T')[0], now.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              data-testid="quick-filter-ytd"
            >
              YTD
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                handleQuickDate(past.toISOString().split('T')[0], now.toISOString().split('T')[0])
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              data-testid="quick-filter-90-days"
            >
              Last 90 Days
            </button>
          </div>

          <div className="h-6 w-px bg-theme hidden sm:block" />

          {/* Insight Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-theme-muted font-medium uppercase tracking-wide">Quick:</span>
            <button
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                const threshold = largeThreshold || 100
                onFiltersChange({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0],
                  amountMin: '',
                  amountMax: `-${threshold}`
                })
                setShowAdvanced(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors dark:border-orange-700 dark:text-orange-300 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
              title={largeThreshold ? `Large transactions this month (over $${largeThreshold} - 2σ above your average)` : 'Large transactions this month'}
              data-testid="quick-filter-large"
            >
              ⚠️ Large{largeThreshold ? ` ($${largeThreshold}+)` : ''}
            </button>
            <button
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                onFiltersChange({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0],
                  amountMin: '',
                  amountMax: '-50'
                })
                setShowAdvanced(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
              title="Top spending this month (over $50)"
              data-testid="quick-filter-top-spending"
            >
              🏪 Top Spending
            </button>
            <button
              onClick={() => {
                onFiltersChange({
                  ...filters,
                  amountMin: '',
                  amountMax: '-100'
                })
                setShowAdvanced(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors dark:border-red-700 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50"
              title="Transactions over $100"
              data-testid="quick-filter-100"
            >
              💰 Large ($100+)
            </button>
            <button
              onClick={() => {
                onFiltersChange({ ...filters, status: 'unreconciled' })
                setShowAdvanced(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50"
              title="Transactions needing review"
              data-testid="quick-filter-unreconciled"
            >
              📋 Unreconciled
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4" data-testid="main-filters">
        {/* Primary filters row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Search merchant or description..."
            className="input"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearch()
            }}
            data-testid="filter-search"
          />
          <select
            className="input"
            value={filters.bucket}
            onChange={(e) => onFiltersChange({ ...filters, bucket: e.target.value })}
            data-testid="filter-bucket"
          >
            <option value="">All Buckets</option>
            {bucketTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={filters.occasion}
            onChange={(e) => onFiltersChange({ ...filters, occasion: e.target.value })}
            data-testid="filter-occasion"
          >
            <option value="">All Occasions</option>
            {occasionTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1).replace(/-/g, ' ')}
              </option>
            ))}
          </select>

          {/* Account dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-full px-4 py-2 border border-theme rounded-md text-left flex justify-between items-center bg-theme-elevated"
              data-testid="filter-accounts-btn"
            >
              <span className={filters.accounts.length > 0 || filters.accountsExclude.length > 0 ? 'text-theme' : 'text-theme-muted'}>
                {filters.accounts.length > 0
                  ? `${filters.accounts.length} selected`
                  : filters.accountsExclude.length > 0
                    ? `Excluding ${filters.accountsExclude.length}`
                    : 'All Accounts'}
              </span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAccountDropdown && (
              <div className="absolute z-20 mt-1 w-72 bg-theme-elevated border border-theme rounded-md shadow-lg max-h-64 overflow-y-auto" data-testid="accounts-dropdown">
                <div className="p-2 border-b border-theme text-xs text-theme-muted">
                  Click to include, Shift+Click to exclude
                </div>
                {accountTags.map((tag) => {
                  const isIncluded = filters.accounts.includes(tag.value)
                  const isExcluded = filters.accountsExclude.includes(tag.value)
                  return (
                    <div
                      key={tag.id}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          if (isExcluded) {
                            onFiltersChange({
                              ...filters,
                              accountsExclude: filters.accountsExclude.filter(a => a !== tag.value)
                            })
                          } else {
                            onFiltersChange({
                              ...filters,
                              accounts: filters.accounts.filter(a => a !== tag.value),
                              accountsExclude: [...filters.accountsExclude, tag.value]
                            })
                          }
                        } else {
                          if (isIncluded) {
                            onFiltersChange({
                              ...filters,
                              accounts: filters.accounts.filter(a => a !== tag.value)
                            })
                          } else {
                            onFiltersChange({
                              ...filters,
                              accounts: [...filters.accounts, tag.value],
                              accountsExclude: filters.accountsExclude.filter(a => a !== tag.value)
                            })
                          }
                        }
                      }}
                      className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                        isIncluded ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' :
                        isExcluded ? 'bg-negative text-negative' :
                        'hover:bg-[var(--color-bg-hover)]'
                      }`}
                      data-testid={`account-option-${tag.value}`}
                    >
                      <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${
                        isIncluded ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white' :
                        isExcluded ? 'bg-[var(--color-negative)] border-[var(--color-negative)] text-white' :
                        'border-theme'
                      }`}>
                        {isIncluded && '✓'}
                        {isExcluded && '−'}
                      </span>
                      <span>{tag.description || tag.value}</span>
                    </div>
                  )
                })}
                {(filters.accounts.length > 0 || filters.accountsExclude.length > 0) && (
                  <div className="p-2 border-t border-theme">
                    <button
                      onClick={() => onFiltersChange({ ...filters, accounts: [], accountsExclude: [] })}
                      className="text-xs text-theme-muted hover:text-theme"
                    >
                      Clear selection
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onSearch}
              className="flex-1 btn-primary"
              data-testid="search-btn"
            >
              Search
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`px-3 py-2 border border-theme rounded-md ${showAdvanced ? 'bg-[var(--color-bg-hover)]' : ''}`}
              title="Advanced filters"
              data-testid="toggle-advanced-btn"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced filters (collapsible) */}
        {(showAdvanced || hasAdvancedFilters) && (
          <div className="pt-4 border-t border-theme" data-testid="advanced-filters">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <select
                className="input"
                value={filters.status}
                onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
                data-testid="filter-status"
              >
                <option value="">All Status</option>
                <option value="unreconciled">Unreconciled</option>
                <option value="matched">Matched</option>
                <option value="manually_entered">Manually Entered</option>
                <option value="ignored">Ignored</option>
              </select>
              <select
                className="input"
                value={filters.transfers}
                onChange={(e) => onFiltersChange({ ...filters, transfers: e.target.value as 'all' | 'hide' | 'only' })}
                title="Filter internal transfers (CC payments, bank transfers)"
                data-testid="filter-transfers"
              >
                <option value="hide">Hide Transfers</option>
                <option value="all">All Transactions</option>
                <option value="only">Transfers Only</option>
              </select>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  placeholder="Min $"
                  className="input w-full"
                  value={filters.amountMin}
                  onChange={(e) => onFiltersChange({ ...filters, amountMin: e.target.value })}
                  data-testid="filter-amount-min"
                />
                <span className="text-theme-muted">–</span>
                <input
                  type="number"
                  placeholder="Max $"
                  className="input w-full"
                  value={filters.amountMax}
                  onChange={(e) => onFiltersChange({ ...filters, amountMax: e.target.value })}
                  data-testid="filter-amount-max"
                />
              </div>
              <input
                type="date"
                className="input"
                value={filters.startDate}
                onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
                title="Start date"
                data-testid="filter-start-date"
              />
              <input
                type="date"
                className="input"
                value={filters.endDate}
                onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
                title="End date"
                data-testid="filter-end-date"
              />
              <button
                onClick={clearAllFilters}
                className="px-4 py-2 text-theme-muted border border-theme rounded-md hover:bg-[var(--color-bg-hover)]"
                data-testid="clear-all-btn"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Active filters pills */}
        {(filters.bucket || filters.occasion || filters.accounts.length > 0 || filters.accountsExclude.length > 0 || filters.status || filters.amountMin || filters.amountMax || filters.startDate || filters.endDate || filters.transfers !== 'hide') && (
          <div className="flex flex-wrap gap-2 pt-2" data-testid="active-filters">
            {filters.bucket && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs dark:bg-green-900/30 dark:text-green-300">
                Bucket: {filters.bucket}
                <button onClick={() => onFiltersChange({ ...filters, bucket: '' })} className="hover:text-green-900">×</button>
              </span>
            )}
            {filters.occasion && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs dark:bg-purple-900/30 dark:text-purple-300">
                Occasion: {filters.occasion.replace(/-/g, ' ')}
                <button onClick={() => onFiltersChange({ ...filters, occasion: '' })} className="hover:text-purple-900">×</button>
              </span>
            )}
            {filters.accounts.map(acc => (
              <span key={`inc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs dark:bg-blue-900/30 dark:text-blue-300">
                Account: {accountTags.find(t => t.value === acc)?.description || acc}
                <button onClick={() => onFiltersChange({ ...filters, accounts: filters.accounts.filter(a => a !== acc) })} className="hover:text-blue-900">×</button>
              </span>
            ))}
            {filters.accountsExclude.map(acc => (
              <span key={`exc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs dark:bg-red-900/30 dark:text-red-300">
                NOT: {accountTags.find(t => t.value === acc)?.description || acc}
                <button onClick={() => onFiltersChange({ ...filters, accountsExclude: filters.accountsExclude.filter(a => a !== acc) })} className="hover:text-red-900">×</button>
              </span>
            ))}
            {filters.status && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs dark:bg-yellow-900/30 dark:text-yellow-300">
                Status: {filters.status}
                <button onClick={() => onFiltersChange({ ...filters, status: '' })} className="hover:text-yellow-900">×</button>
              </span>
            )}
            {(filters.amountMin || filters.amountMax) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs dark:bg-orange-900/30 dark:text-orange-300">
                Amount: {filters.amountMin || '∞'} – {filters.amountMax || '∞'}
                <button onClick={() => onFiltersChange({ ...filters, amountMin: '', amountMax: '' })} className="hover:text-orange-900">×</button>
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs dark:bg-gray-700 dark:text-gray-300">
                Date: {filters.startDate || '...'} – {filters.endDate || '...'}
                <button onClick={() => onFiltersChange({ ...filters, startDate: '', endDate: '' })} className="hover:text-gray-900">×</button>
              </span>
            )}
            {filters.transfers !== 'hide' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs dark:bg-blue-900/30 dark:text-blue-300">
                {filters.transfers === 'all' ? 'Including Transfers' : 'Transfers Only'}
                <button onClick={() => onFiltersChange({ ...filters, transfers: 'hide' })} className="hover:text-blue-900">×</button>
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}
