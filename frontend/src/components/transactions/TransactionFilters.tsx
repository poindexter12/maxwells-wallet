'use client'

import { useTranslations } from 'next-intl'
import { DatePicker } from '@/components/DatePicker'
import { TEST_IDS } from '@/test-ids'
import { useFormat } from '@/hooks/useFormat'

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface FilterState {
  search: string
  bucket: string
  occasion: string
  accounts: string[]
  accountsExclude: string[]
  status: string
  amountMin: string
  amountMax: string
  startDate: string
  endDate: string
  transfers: 'all' | 'hide' | 'only'
}

interface TransactionFiltersProps {
  filters: FilterState
  setFilters: (filters: FilterState) => void
  searchInput: string
  setSearchInput: (value: string) => void
  showAdvancedFilters: boolean
  setShowAdvancedFilters: (show: boolean) => void
  showAccountDropdown: boolean
  setShowAccountDropdown: (show: boolean) => void
  bucketTags: Tag[]
  occasionTags: Tag[]
  accountTags: Tag[]
  largeThreshold: number | null
}

export function TransactionFilters({
  filters,
  setFilters,
  searchInput,
  setSearchInput,
  showAdvancedFilters,
  setShowAdvancedFilters,
  showAccountDropdown,
  setShowAccountDropdown,
  bucketTags,
  occasionTags,
  accountTags,
  largeThreshold,
}: TransactionFiltersProps) {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const { formatCurrency, getDefaultLargeThreshold } = useFormat()

  return (
    <>
      {/* Quick Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          {/* Date Range Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-theme-muted font-medium uppercase tracking-wide">{t('filters.date')}</span>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_THIS_MONTH}
              data-chaos-target="txn-quick-this-month"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.thisMonth')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LAST_MONTH}
              data-chaos-target="txn-quick-last-month"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
              title={`${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
            >
              {t('filters.lastMonth')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_THIS_YEAR}
              data-chaos-target="txn-quick-this-year"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                const lastDay = new Date(now.getFullYear(), 11, 31)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.thisYear')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_YTD}
              data-chaos-target="txn-quick-ytd"
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), 0, 1)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.ytd')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LAST_90_DAYS}
              data-chaos-target="txn-quick-last-90"
              onClick={() => {
                const now = new Date()
                const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
                setFilters({
                  ...filters,
                  startDate: past.toISOString().split('T')[0],
                  endDate: now.toISOString().split('T')[0]
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-theme hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              {t('filters.last90Days')}
            </button>
          </div>

          <div className="h-6 w-px bg-theme hidden sm:block" />

          {/* Insight Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-theme-muted font-medium uppercase tracking-wide">{t('filters.quick')}</span>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LARGE_DYNAMIC}
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                // Use dynamic threshold or fall back to locale-specific default
                const threshold = largeThreshold || getDefaultLargeThreshold()
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0],
                  amountMin: '',
                  amountMax: `-${threshold}`
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 transition-colors dark:border-orange-700 dark:text-orange-300 dark:bg-orange-900/30 dark:hover:bg-orange-900/50"
              title={largeThreshold ? t('filters.largeTitleWithThreshold', { threshold: formatCurrency(largeThreshold) }) : t('filters.largeTitle')}
            >
              ⚠️ {t('filters.largeDynamic', { threshold: formatCurrency(largeThreshold || getDefaultLargeThreshold()) })}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_TOP_SPENDING}
              onClick={() => {
                const now = new Date()
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                setFilters({
                  ...filters,
                  startDate: firstDay.toISOString().split('T')[0],
                  endDate: lastDay.toISOString().split('T')[0],
                  amountMin: '',
                  amountMax: '-50'
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:hover:bg-blue-900/50"
              title="Top spending this month (over $50)"
            >
              🏪 {t('filters.topSpending')}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_LARGE}
              onClick={() => {
                const threshold = getDefaultLargeThreshold()
                setFilters({
                  ...filters,
                  amountMin: '',
                  amountMax: `-${threshold}`
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors dark:border-red-700 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50"
              title={t('filters.largeTitle')}
            >
              💰 {t('filters.largeDynamic', { threshold: formatCurrency(getDefaultLargeThreshold()) })}
            </button>
            <button
              data-testid={TEST_IDS.QUICK_FILTER_UNRECONCILED}
              onClick={() => {
                setFilters({
                  ...filters,
                  status: 'unreconciled'
                })
                setShowAdvancedFilters(true)
              }}
              className="px-3 py-1.5 text-xs rounded-full border border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50"
              title="Transactions needing review"
            >
              📋 {t('status.unreconciled')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        {/* Primary filters row */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            data-testid={TEST_IDS.FILTER_SEARCH}
            data-chaos-target="txn-filter-search"
            type="text"
            placeholder={t('searchPlaceholder')}
            className="input"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setFilters({ ...filters, search: searchInput })
              }
            }}
          />
          <select
            data-testid={TEST_IDS.FILTER_BUCKET}
            data-chaos-target="txn-filter-bucket"
            className="input"
            value={filters.bucket}
            onChange={(e) => setFilters({ ...filters, bucket: e.target.value })}
          >
            <option value="">{t('allBuckets')}</option>
            {bucketTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
              </option>
            ))}
          </select>
          <select
            data-testid={TEST_IDS.FILTER_OCCASION}
            data-chaos-target="txn-filter-occasion"
            className="input"
            value={filters.occasion}
            onChange={(e) => setFilters({ ...filters, occasion: e.target.value })}
          >
            <option value="">{t('allOccasions')}</option>
            {occasionTags.map((tag) => (
              <option key={tag.id} value={tag.value}>
                {tag.value.charAt(0).toUpperCase() + tag.value.slice(1).replace(/-/g, ' ')}
              </option>
            ))}
          </select>
          <div className="relative">
            <button
              data-testid={TEST_IDS.FILTER_ACCOUNT}
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="w-full px-4 py-2 border border-theme rounded-md text-left flex justify-between items-center bg-theme-elevated"
            >
              <span className={filters.accounts.length > 0 || filters.accountsExclude.length > 0 ? 'text-theme' : 'text-theme-muted'}>
                {filters.accounts.length > 0
                  ? `${filters.accounts.length} selected`
                  : filters.accountsExclude.length > 0
                    ? `Excluding ${filters.accountsExclude.length}`
                    : t('allAccounts')}
              </span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAccountDropdown && (
              <div className="absolute z-20 mt-1 w-72 bg-theme-elevated border border-theme rounded-md shadow-lg max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-theme text-xs text-theme-muted">
                  {t('filters.clickToInclude')}
                </div>
                {accountTags.map((tag) => {
                  const isIncluded = filters.accounts.includes(tag.value)
                  const isExcluded = filters.accountsExclude.includes(tag.value)
                  return (
                    <div
                      key={tag.id}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          // Toggle exclude
                          if (isExcluded) {
                            setFilters({
                              ...filters,
                              accountsExclude: filters.accountsExclude.filter(a => a !== tag.value)
                            })
                          } else {
                            setFilters({
                              ...filters,
                              accounts: filters.accounts.filter(a => a !== tag.value),
                              accountsExclude: [...filters.accountsExclude, tag.value]
                            })
                          }
                        } else {
                          // Toggle include
                          if (isIncluded) {
                            setFilters({
                              ...filters,
                              accounts: filters.accounts.filter(a => a !== tag.value)
                            })
                          } else {
                            setFilters({
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
                      onClick={() => setFilters({ ...filters, accounts: [], accountsExclude: [] })}
                      className="text-xs text-theme-muted hover:text-theme"
                    >
                      {t('bulk.clearSelection')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, search: searchInput })}
              className="flex-1 btn-primary"
            >
              {tCommon('search')}
            </button>
            <button
              data-testid={TEST_IDS.FILTER_ADVANCED_TOGGLE}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-2 border border-theme rounded-md ${showAdvancedFilters ? 'bg-[var(--color-bg-hover)]' : ''}`}
              title={t('filters.advanced')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Advanced filters (collapsible) */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-theme">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <select
                data-testid={TEST_IDS.FILTER_STATUS}
                data-chaos-target="txn-filter-status"
                className="input"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">{t('allStatus')}</option>
                <option value="unreconciled">{t('status.unreconciled')}</option>
                <option value="matched">{t('status.matched')}</option>
                <option value="manually_entered">{t('status.manuallyEntered')}</option>
                <option value="ignored">{t('status.ignored')}</option>
              </select>
              <select
                data-testid={TEST_IDS.FILTER_TRANSFERS}
                data-chaos-target="txn-filter-transfers"
                className="input"
                value={filters.transfers}
                onChange={(e) => setFilters({ ...filters, transfers: e.target.value as 'all' | 'hide' | 'only' })}
                title="Filter internal transfers (CC payments, bank transfers)"
              >
                <option value="hide">{t('hideTransfers')}</option>
                <option value="all">{t('showTransfers')}</option>
                <option value="only">{t('transfersOnly')}</option>
              </select>
              <div className="flex gap-2 items-center">
                <input
                  data-testid={TEST_IDS.FILTER_AMOUNT_MIN}
                  data-chaos-target="txn-filter-amount-min"
                  type="number"
                  placeholder={t('minAmount', { defaultValue: 'Min $' })}
                  className="input w-full"
                  value={filters.amountMin}
                  onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })}
                />
                <span className="text-theme-muted">–</span>
                <input
                  data-testid={TEST_IDS.FILTER_AMOUNT_MAX}
                  data-chaos-target="txn-filter-amount-max"
                  type="number"
                  placeholder={t('maxAmount', { defaultValue: 'Max $' })}
                  className="input w-full"
                  value={filters.amountMax}
                  onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })}
                />
              </div>
              <DatePicker
                data-testid={TEST_IDS.FILTER_DATE_START}
                data-chaos-target="txn-filter-date-start"
                className="input"
                value={filters.startDate}
                onChange={(value) => setFilters({ ...filters, startDate: value })}
                title={t('startDate', { defaultValue: 'Start date' })}
              />
              <DatePicker
                data-testid={TEST_IDS.FILTER_DATE_END}
                data-chaos-target="txn-filter-date-end"
                className="input"
                value={filters.endDate}
                onChange={(value) => setFilters({ ...filters, endDate: value })}
                title={t('endDate', { defaultValue: 'End date' })}
              />
              <button
                data-testid={TEST_IDS.FILTER_CLEAR}
                data-chaos-target="txn-filter-clear"
                onClick={() => {
                  setSearchInput('')
                  setFilters({
                    search: '',
                    bucket: '',
                    occasion: '',
                    accounts: [],
                    accountsExclude: [],
                    status: '',
                    amountMin: '',
                    amountMax: '',
                    startDate: '',
                    endDate: '',
                    transfers: 'hide'
                  })
                  setShowAccountDropdown(false)
                }}
                className="px-4 py-2 text-theme-muted border border-theme rounded-md hover:bg-[var(--color-bg-hover)]"
              >
                {t('filters.clearAll')}
              </button>
            </div>
          </div>
        )}

        {/* Active filters pills */}
        {(filters.bucket || filters.occasion || filters.accounts.length > 0 || filters.accountsExclude.length > 0 || filters.status || filters.amountMin || filters.amountMax || filters.startDate || filters.endDate || filters.transfers !== 'hide') && (
          <div className="flex flex-wrap gap-2 pt-2">
            {filters.bucket && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {t('bucket')}: {filters.bucket}
                <button onClick={() => setFilters({ ...filters, bucket: '' })} className="hover:text-green-900">×</button>
              </span>
            )}
            {filters.occasion && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                {t('occasion')}: {filters.occasion.replace(/-/g, ' ')}
                <button onClick={() => setFilters({ ...filters, occasion: '' })} className="hover:text-purple-900">×</button>
              </span>
            )}
            {filters.accounts.map(acc => (
              <span key={`inc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {t('account')}: {accountTags.find(t => t.value === acc)?.description || acc}
                <button onClick={() => setFilters({ ...filters, accounts: filters.accounts.filter(a => a !== acc) })} className="hover:text-blue-900">×</button>
              </span>
            ))}
            {filters.accountsExclude.map(acc => (
              <span key={`exc-${acc}`} className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                NOT: {accountTags.find(t => t.value === acc)?.description || acc}
                <button onClick={() => setFilters({ ...filters, accountsExclude: filters.accountsExclude.filter(a => a !== acc) })} className="hover:text-red-900">×</button>
              </span>
            ))}
            {filters.status && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                {tFields('status')}: {filters.status}
                <button onClick={() => setFilters({ ...filters, status: '' })} className="hover:text-yellow-900">×</button>
              </span>
            )}
            {(filters.amountMin || filters.amountMax) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                {tFields('amount')}: {filters.amountMin || '∞'} – {filters.amountMax || '∞'}
                <button onClick={() => setFilters({ ...filters, amountMin: '', amountMax: '' })} className="hover:text-orange-900">×</button>
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                {tFields('date')}: {filters.startDate || '...'} – {filters.endDate || '...'}
                <button onClick={() => setFilters({ ...filters, startDate: '', endDate: '' })} className="hover:text-gray-900">×</button>
              </span>
            )}
            {filters.transfers !== 'hide' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {filters.transfers === 'all' ? t('showTransfers') : t('transfersOnly')}
                <button onClick={() => setFilters({ ...filters, transfers: 'hide' })} className="hover:text-blue-900">×</button>
              </span>
            )}
          </div>
        )}
      </div>
    </>
  )
}
