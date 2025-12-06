import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBulkSelection } from './useBulkSelection'

interface TestItem {
  id: number
  name: string
}

const testItems: TestItem[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
]

describe('useBulkSelection', () => {
  it('starts with no selections', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('can toggle selection on', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.toggle(1)
    })

    expect(result.current.isSelected(1)).toBe(true)
    expect(result.current.selectedCount).toBe(1)
  })

  it('can toggle selection off', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.toggle(1)
    })

    act(() => {
      result.current.toggle(1)
    })

    expect(result.current.isSelected(1)).toBe(false)
    expect(result.current.selectedCount).toBe(0)
  })

  it('can select all items', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.selectAll(testItems)
    })

    expect(result.current.selectedCount).toBe(3)
    expect(result.current.isSelected(1)).toBe(true)
    expect(result.current.isSelected(2)).toBe(true)
    expect(result.current.isSelected(3)).toBe(true)
  })

  it('toggleAll selects all when none selected', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.toggleAll(testItems)
    })

    expect(result.current.selectedCount).toBe(3)
    expect(result.current.isAllSelected(testItems)).toBe(true)
  })

  it('toggleAll deselects all when all selected', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.selectAll(testItems)
    })

    act(() => {
      result.current.toggleAll(testItems)
    })

    expect(result.current.selectedCount).toBe(0)
    expect(result.current.isAllSelected(testItems)).toBe(false)
  })

  it('can clear selection', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.toggle(1)
      result.current.toggle(2)
    })

    act(() => {
      result.current.clearSelection()
    })

    expect(result.current.selectedCount).toBe(0)
  })

  it('isIndeterminate when some but not all selected', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    act(() => {
      result.current.toggle(1)
    })

    expect(result.current.isIndeterminate(testItems)).toBe(true)
    expect(result.current.isAllSelected(testItems)).toBe(false)
  })

  it('isAllSelected returns false for empty items array', () => {
    const { result } = renderHook(() => useBulkSelection<TestItem>())

    expect(result.current.isAllSelected([])).toBe(false)
  })
})
