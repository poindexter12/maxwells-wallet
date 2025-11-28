'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface RecurringPattern {
  id: number
  merchant: string
  category?: string
  amount_min: number
  amount_max: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  last_seen_date?: string
  next_expected_date?: string
  confidence_score: number
  status: 'active' | 'paused' | 'ended'
  created_at: string
}

interface UpcomingTransaction {
  merchant: string
  category?: string
  expected_date: string
  days_until: number
  frequency: string
  estimated_amount: number
  confidence: number
}

interface MissingTransaction {
  merchant: string
  category?: string
  expected_date: string
  days_overdue: number
  frequency: string
  estimated_amount: number
}

export default function RecurringPage() {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingTransaction[]>([])
  const [missing, setMissing] = useState<MissingTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [activeTab, setActiveTab] = useState<'patterns' | 'upcoming' | 'missing'>('patterns')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [patternsRes, upcomingRes, missingRes] = await Promise.all([
        fetch('/api/v1/recurring'),
        fetch('/api/v1/recurring/predictions/upcoming?days_ahead=30'),
        fetch('/api/v1/recurring/missing?days_overdue=7')
      ])

      const patternsData = await patternsRes.json()
      const upcomingData = await upcomingRes.json()
      const missingData = await missingRes.json()

      setPatterns(patternsData)
      setUpcoming(upcomingData.upcoming || [])
      setMissing(missingData.missing || [])
      setLoading(false)
    } catch (error) {
      console.error('Error fetching recurring data:', error)
      setLoading(false)
    }
  }

  async function handleDetect() {
    setDetecting(true)
    try {
      const res = await fetch('/api/v1/recurring/detect', { method: 'POST' })
      const data = await res.json()
      alert(`Detected ${data.detected_count} new recurring patterns`)
      fetchData()
    } catch (error) {
      console.error('Error detecting patterns:', error)
      alert('Error detecting patterns')
    } finally {
      setDetecting(false)
    }
  }

  async function handleToggleStatus(pattern: RecurringPattern) {
    const newStatus = pattern.status === 'active' ? 'paused' : 'active'

    try {
      await fetch(`/api/v1/recurring/${pattern.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      fetchData()
    } catch (error) {
      console.error('Error updating pattern:', error)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this pattern?')) return

    try {
      await fetch(`/api/v1/recurring/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Error deleting pattern:', error)
    }
  }

  function getFrequencyBadge(frequency: string) {
    const colors: Record<string, string> = {
      weekly: 'bg-purple-100 text-purple-800',
      biweekly: 'bg-indigo-100 text-indigo-800',
      monthly: 'bg-blue-100 text-blue-800',
      quarterly: 'bg-green-100 text-green-800',
      yearly: 'bg-orange-100 text-orange-800'
    }
    return colors[frequency] || 'bg-gray-100 text-gray-800'
  }

  function getConfidenceColor(confidence: number) {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recurring Transactions</h1>
          <p className="mt-2 text-sm text-gray-600">
            Track subscriptions, bills, and recurring payments
          </p>
        </div>
        <button
          onClick={handleDetect}
          disabled={detecting}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {detecting ? 'Detecting...' : 'Detect Patterns'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Active Patterns</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {patterns.filter(p => p.status === 'active').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Upcoming (30 days)</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {upcoming.length}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            ~${upcoming.reduce((sum, t) => sum + t.estimated_amount, 0).toFixed(2)} expected
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Missing/Overdue</p>
          <p className="mt-2 text-3xl font-bold text-red-600">
            {missing.length}
          </p>
          {missing.length > 0 && (
            <p className="mt-1 text-sm text-gray-600">
              Review overdue patterns
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('patterns')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'patterns'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Patterns ({patterns.length})
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'upcoming'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Upcoming ({upcoming.length})
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'missing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Missing ({missing.length})
          </button>
        </nav>
      </div>

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div className="bg-white rounded-lg shadow">
          {patterns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No recurring patterns detected yet</p>
              <button
                onClick={handleDetect}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Detect Patterns
              </button>
            </div>
          ) : (
            <div className="divide-y">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{pattern.merchant}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getFrequencyBadge(pattern.frequency)}`}>
                          {pattern.frequency}
                        </span>
                        {pattern.category && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">
                            {pattern.category}
                          </span>
                        )}
                        {pattern.status === 'paused' && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                            Paused
                          </span>
                        )}
                        {pattern.status === 'ended' && (
                          <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                            Ended
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Amount Range</p>
                          <p className="font-medium">${pattern.amount_min.toFixed(2)} - ${pattern.amount_max.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Confidence</p>
                          <p className={`font-medium ${getConfidenceColor(pattern.confidence_score)}`}>
                            {(pattern.confidence_score * 100).toFixed(0)}%
                          </p>
                        </div>
                        {pattern.last_seen_date && (
                          <div>
                            <p className="text-gray-600">Last Seen</p>
                            <p className="font-medium">{format(new Date(pattern.last_seen_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                        {pattern.next_expected_date && (
                          <div>
                            <p className="text-gray-600">Next Expected</p>
                            <p className="font-medium">{format(new Date(pattern.next_expected_date), 'MMM dd, yyyy')}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleStatus(pattern)}
                        className={`px-3 py-1 text-sm rounded ${
                          pattern.status === 'active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {pattern.status === 'active' ? 'Active' : 'Paused'}
                      </button>
                      <button
                        onClick={() => handleDelete(pattern.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Tab */}
      {activeTab === 'upcoming' && (
        <div className="bg-white rounded-lg shadow">
          {upcoming.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No upcoming transactions in the next 30 days</p>
          ) : (
            <div className="divide-y">
              {upcoming.map((txn, idx) => (
                <div key={idx} className="p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{txn.merchant}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getFrequencyBadge(txn.frequency)}`}>
                          {txn.frequency}
                        </span>
                        {txn.category && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                            {txn.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Expected {format(new Date(txn.expected_date), 'MMM dd, yyyy')} ({txn.days_until} days)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        ${txn.estimated_amount.toFixed(2)}
                      </p>
                      <p className={`text-xs ${getConfidenceColor(txn.confidence)}`}>
                        {(txn.confidence * 100).toFixed(0)}% confidence
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Missing Tab */}
      {activeTab === 'missing' && (
        <div className="bg-white rounded-lg shadow">
          {missing.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No missing or overdue transactions</p>
          ) : (
            <div className="divide-y">
              {missing.map((txn, idx) => (
                <div key={idx} className="p-6 bg-red-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{txn.merchant}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getFrequencyBadge(txn.frequency)}`}>
                          {txn.frequency}
                        </span>
                        {txn.category && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                            {txn.category}
                          </span>
                        )}
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                          {txn.days_overdue} days overdue
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Expected {format(new Date(txn.expected_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        ${txn.estimated_amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
