import { useState, useCallback } from 'react'
import { Widget } from '@/components/widgets/types'

interface UseWidgetManagementReturn {
  widgets: Widget[]
  loading: boolean
  fetchWidgets: () => Promise<void>
  toggleVisibility: (widgetId: number) => Promise<void>
  moveUp: (widgetId: number) => Promise<void>
  moveDown: (widgetId: number) => Promise<void>
  reset: () => Promise<void>
  duplicate: (widgetId: number) => Promise<void>
  updateWidget: (widgetId: number, config: { buckets?: string[] }) => Promise<void>
  deleteWidget: (widgetId: number) => Promise<void>
}

export function useWidgetManagement(): UseWidgetManagementReturn {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWidgets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/dashboard/widgets')
      if (res.ok) {
        const data = await res.json()
        setWidgets(data)
      }
    } catch (error) {
      console.error('Error fetching widgets:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleVisibility = useCallback(async (widgetId: number) => {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}/visibility`, {
        method: 'PATCH'
      })
      await fetchWidgets()
    } catch (error) {
      console.error('Error toggling visibility:', error)
    }
  }, [fetchWidgets])

  const moveUp = useCallback(async (widgetId: number) => {
    const sorted = [...widgets].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex(w => w.id === widgetId)
    if (index <= 0) return

    const updates = [
      { id: sorted[index].id, position: sorted[index - 1].position },
      { id: sorted[index - 1].id, position: sorted[index].position }
    ]

    try {
      await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      })
      await fetchWidgets()
    } catch (error) {
      console.error('Error reordering:', error)
    }
  }, [widgets, fetchWidgets])

  const moveDown = useCallback(async (widgetId: number) => {
    const sorted = [...widgets].sort((a, b) => a.position - b.position)
    const index = sorted.findIndex(w => w.id === widgetId)
    if (index < 0 || index >= sorted.length - 1) return

    const updates = [
      { id: sorted[index].id, position: sorted[index + 1].position },
      { id: sorted[index + 1].id, position: sorted[index].position }
    ]

    try {
      await fetch('/api/v1/dashboard/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: updates })
      })
      await fetchWidgets()
    } catch (error) {
      console.error('Error reordering:', error)
    }
  }, [widgets, fetchWidgets])

  const reset = useCallback(async () => {
    try {
      await fetch('/api/v1/dashboard/reset', { method: 'POST' })
      await fetchWidgets()
    } catch (error) {
      console.error('Error resetting:', error)
    }
  }, [fetchWidgets])

  const duplicate = useCallback(async (widgetId: number) => {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}/duplicate`, { method: 'POST' })
      await fetchWidgets()
    } catch (error) {
      console.error('Error duplicating widget:', error)
    }
  }, [fetchWidgets])

  const updateWidget = useCallback(async (
    widgetId: number,
    config: { buckets?: string[] }
  ) => {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: Object.keys(config).length > 0 ? JSON.stringify(config) : null
        })
      })
      await fetchWidgets()
    } catch (error) {
      console.error('Error updating widget:', error)
    }
  }, [fetchWidgets])

  const deleteWidget = useCallback(async (widgetId: number) => {
    try {
      await fetch(`/api/v1/dashboard/widgets/${widgetId}`, { method: 'DELETE' })
      await fetchWidgets()
    } catch (error) {
      console.error('Error deleting widget:', error)
    }
  }, [fetchWidgets])

  return {
    widgets,
    loading,
    fetchWidgets,
    toggleVisibility,
    moveUp,
    moveDown,
    reset,
    duplicate,
    updateWidget,
    deleteWidget
  }
}
