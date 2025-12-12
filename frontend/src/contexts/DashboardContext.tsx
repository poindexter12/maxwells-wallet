'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Date range types supported by dashboards
export type DateRangeType = 'mtd' | 'qtd' | 'ytd' | 'last_30_days' | 'last_90_days' | 'last_year'

export interface DateRange {
  start_date: string  // ISO date string (YYYY-MM-DD)
  end_date: string    // ISO date string (YYYY-MM-DD)
  label: string       // Human-readable label
}

export interface Dashboard {
  id: number
  name: string
  description: string | null
  date_range_type: DateRangeType
  date_range: DateRange  // Calculated dates from backend
  is_default: boolean
  position: number
  created_at: string
  updated_at: string
}

interface DashboardContextType {
  dashboards: Dashboard[]
  currentDashboard: Dashboard | null
  loading: boolean
  error: string | null
  setCurrentDashboard: (dashboard: Dashboard) => void
  refreshDashboards: () => Promise<void>
  createDashboard: (data: Partial<Dashboard>) => Promise<Dashboard | null>
  updateDashboard: (id: number, data: Partial<Dashboard>) => Promise<Dashboard | null>
  deleteDashboard: (id: number) => Promise<boolean>
  cloneDashboard: (id: number) => Promise<Dashboard | null>
  setDefaultDashboard: (id: number) => Promise<boolean>
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refreshDashboards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Intentional: fetch once on mount

  async function refreshDashboards() {
    try {
      setLoading(true)
      const res = await fetch('/api/v1/dashboards')
      if (!res.ok) throw new Error('Failed to fetch dashboards')
      const data = await res.json()
      setDashboards(data)

      // Set current dashboard to default if not already set
      if (!currentDashboard) {
        const defaultDash = data.find((d: Dashboard) => d.is_default) || data[0]
        setCurrentDashboard(defaultDash)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function createDashboard(data: Partial<Dashboard>): Promise<Dashboard | null> {
    try {
      const res = await fetch('/api/v1/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create dashboard')
      const newDashboard = await res.json()
      await refreshDashboards()
      return newDashboard
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }

  async function updateDashboard(id: number, data: Partial<Dashboard>): Promise<Dashboard | null> {
    try {
      const res = await fetch(`/api/v1/dashboards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update dashboard')
      const updated = await res.json()
      await refreshDashboards()
      if (currentDashboard?.id === id) {
        setCurrentDashboard(updated)
      }
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }

  async function deleteDashboard(id: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/dashboards/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete dashboard')
      await refreshDashboards()
      // If we deleted the current dashboard, switch to default
      if (currentDashboard?.id === id) {
        const defaultDash = dashboards.find(d => d.is_default && d.id !== id) || dashboards[0]
        setCurrentDashboard(defaultDash)
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }

  async function cloneDashboard(id: number): Promise<Dashboard | null> {
    try {
      const res = await fetch(`/api/v1/dashboards/${id}/clone`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to clone dashboard')
      const cloned = await res.json()
      await refreshDashboards()
      return cloned
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    }
  }

  async function setDefaultDashboard(id: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/dashboards/${id}/set-default`, {
        method: 'POST'
      })
      if (!res.ok) throw new Error('Failed to set default')
      await refreshDashboards()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }

  return (
    <DashboardContext.Provider
      value={{
        dashboards,
        currentDashboard,
        loading,
        error,
        setCurrentDashboard,
        refreshDashboards,
        createDashboard,
        updateDashboard,
        deleteDashboard,
        cloneDashboard,
        setDefaultDashboard
      }}
    >
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const context = useContext(DashboardContext)
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider')
  }
  return context
}
