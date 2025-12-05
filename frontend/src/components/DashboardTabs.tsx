'use client'

import { useState } from 'react'
import { useDashboard, Dashboard, DateRangeType } from '@/contexts/DashboardContext'
import Link from 'next/link'

interface DashboardTabsProps {
  onDashboardChange?: (dashboard: Dashboard) => void
}

export default function DashboardTabs({ onDashboardChange }: DashboardTabsProps) {
  const { dashboards, currentDashboard, setCurrentDashboard, createDashboard, loading } = useDashboard()
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const handleTabClick = (dashboard: Dashboard) => {
    setCurrentDashboard(dashboard)
    onDashboardChange?.(dashboard)
  }

  const handleCreateDashboard = async () => {
    if (!newName.trim()) return

    const newDashboard = await createDashboard({
      name: newName.trim(),
      date_range_type: 'mtd' as DateRangeType,
    })

    if (newDashboard) {
      setNewName('')
      setIsCreating(false)
      handleTabClick(newDashboard)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateDashboard()
    } else if (e.key === 'Escape') {
      setIsCreating(false)
      setNewName('')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 mb-4">
        <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-12 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-1 border-b border-gray-200 mb-4">
      {/* Dashboard tabs */}
      {dashboards.map((dashboard) => {
        const isActive = currentDashboard?.id === dashboard.id
        return (
          <button
            key={dashboard.id}
            onClick={() => handleTabClick(dashboard)}
            className={`
              px-4 py-2 rounded-t-lg transition-colors min-w-[120px]
              ${isActive
                ? 'bg-white border border-b-white border-gray-200 -mb-px'
                : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
              }
            `}
          >
            <div className="text-sm font-medium text-gray-900 truncate">
              {dashboard.name}
            </div>
            <div className="text-xs text-gray-500">
              {dashboard.date_range.label}
            </div>
          </button>
        )
      })}

      {/* Create new dashboard */}
      {isCreating ? (
        <div className="px-2 py-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!newName.trim()) {
                setIsCreating(false)
              }
            }}
            placeholder="Dashboard name"
            className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t-lg transition-colors"
          title="Create new dashboard"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {/* Manage dashboards link */}
      <Link
        href="/dashboard/manage"
        className="ml-auto px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        Manage
      </Link>
    </div>
  )
}
