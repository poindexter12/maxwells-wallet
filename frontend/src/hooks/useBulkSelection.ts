import { useState, useCallback } from 'react'

export interface UseBulkSelectionReturn<T extends { id: number }> {
  selectedIds: Set<number>
  isSelected: (id: number) => boolean
  toggle: (id: number) => void
  toggleAll: (items: T[]) => void
  selectAll: (items: T[]) => void
  clearSelection: () => void
  isAllSelected: (items: T[]) => boolean
  isIndeterminate: (items: T[]) => boolean
  selectedCount: number
}

export function useBulkSelection<T extends { id: number }>(): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds])

  const toggle = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback((items: T[]) => {
    setSelectedIds(prev => {
      if (prev.size === items.length) {
        return new Set()
      } else {
        return new Set(items.map(item => item.id))
      }
    })
  }, [])

  const selectAll = useCallback((items: T[]) => {
    setSelectedIds(new Set(items.map(item => item.id)))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isAllSelected = useCallback(
    (items: T[]) => items.length > 0 && selectedIds.size === items.length,
    [selectedIds]
  )

  const isIndeterminate = useCallback(
    (items: T[]) => selectedIds.size > 0 && selectedIds.size < items.length,
    [selectedIds]
  )

  return {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    selectAll,
    clearSelection,
    isAllSelected,
    isIndeterminate,
    selectedCount: selectedIds.size,
  }
}
