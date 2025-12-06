'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'

interface TransferSuggestion {
  id: number
  date: string
  amount: number
  description: string
  merchant: string | null
  account_source: string
  match_reason: string
}

interface TransferStats {
  transfer_count: number
  transfer_total: number
  linked_pairs: number
}

export default function TransfersPanel() {
  const [suggestions, setSuggestions] = useState<TransferSuggestion[]>([])
  const [stats, setStats] = useState<TransferStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [suggestionsRes, statsRes] = await Promise.all([
        fetch('/api/v1/transfers/suggestions?limit=100'),
        fetch('/api/v1/transfers/stats')
      ])
      const suggestionsData = await suggestionsRes.json()
      const statsData = await statsRes.json()
      setSuggestions(suggestionsData.suggestions || [])
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching transfer data:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleSelection(id: number) {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  function selectAll() {
    if (selectedIds.size === suggestions.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(suggestions.map(s => s.id)))
  }

  async function markAsTransfers() {
    if (selectedIds.size === 0) return
    setProcessing(true)
    try {
      await fetch('/api/v1/transfers/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_ids: Array.from(selectedIds), is_transfer: true })
      })
      setSelectedIds(new Set())
      await fetchData()
    } catch (error) {
      console.error('Error marking transfers:', error)
    } finally {
      setProcessing(false)
    }
  }

  function dismissSuggestions() {
    setSuggestions(suggestions.filter(s => !selectedIds.has(s.id)))
    setSelectedIds(new Set())
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-theme-muted" data-testid="transfers-loading">
        Loading...
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="transfers-panel">
      <p className="text-sm text-theme-muted">
        Identify internal transfers to exclude from spending calculations
      </p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4" data-testid="transfers-stats">
          <div className="card p-4">
            <div className="text-sm text-theme-muted">Marked as Transfer</div>
            <div className="text-2xl font-bold text-theme">{stats.transfer_count}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-theme-muted">Transfer Total</div>
            <div className="text-2xl font-bold text-theme">{formatCurrency(stats.transfer_total)}</div>
          </div>
          <div className="card p-4">
            <div className="text-sm text-theme-muted">Linked Pairs</div>
            <div className="text-2xl font-bold text-theme">{stats.linked_pairs}</div>
          </div>
        </div>
      )}

      {/* Suggestions */}
      <div className="card" data-testid="transfers-suggestions">
        <div className="p-4 border-b border-theme flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-theme">Suggested Transfers</h2>
            <p className="text-sm text-theme-muted">{suggestions.length} transactions look like transfers</p>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={dismissSuggestions}
                className="px-3 py-1.5 text-sm border border-theme rounded-md hover:bg-theme-elevated"
                data-testid="dismiss-btn"
              >
                Dismiss ({selectedIds.size})
              </button>
              <button
                onClick={markAsTransfers}
                disabled={processing}
                className="btn-primary text-sm disabled:opacity-50"
                data-testid="mark-transfers-btn"
              >
                {processing ? 'Processing...' : `Mark as Transfers (${selectedIds.size})`}
              </button>
            </div>
          )}
        </div>

        {suggestions.length === 0 ? (
          <div className="p-8 text-center text-theme-muted" data-testid="no-suggestions">
            No transfer suggestions found. All detected transfers have been processed.
          </div>
        ) : (
          <div className="divide-y divide-theme">
            <div className="px-4 py-2 bg-theme-elevated flex items-center gap-4 text-sm font-medium text-theme-muted">
              <input
                type="checkbox"
                checked={selectedIds.size === suggestions.length && suggestions.length > 0}
                onChange={selectAll}
                className="rounded"
                data-testid="select-all-checkbox"
              />
              <span className="w-24">Date</span>
              <span className="w-28 text-right">Amount</span>
              <span className="flex-1">Description</span>
              <span className="w-32">Account</span>
              <span className="w-48">Match Reason</span>
            </div>
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`px-4 py-3 flex items-center gap-4 hover:bg-theme-elevated cursor-pointer ${selectedIds.has(suggestion.id) ? 'bg-theme-elevated' : ''}`}
                onClick={() => toggleSelection(suggestion.id)}
                data-testid={`suggestion-row-${suggestion.id}`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(suggestion.id)}
                  onChange={() => toggleSelection(suggestion.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded"
                />
                <span className="w-24 text-sm text-theme-muted">{format(new Date(suggestion.date), 'MMM d, yyyy')}</span>
                <span className={`w-28 text-right font-mono text-sm ${suggestion.amount < 0 ? 'text-negative' : 'text-positive'}`}>
                  {formatCurrency(suggestion.amount)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-theme truncate">{suggestion.merchant || suggestion.description}</div>
                  {suggestion.merchant && <div className="text-xs text-theme-muted truncate">{suggestion.description}</div>}
                </div>
                <span className="w-32 text-sm text-theme-muted truncate">{suggestion.account_source}</span>
                <span className="w-48 text-xs text-theme-muted truncate" title={suggestion.match_reason}>
                  {suggestion.match_reason}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
