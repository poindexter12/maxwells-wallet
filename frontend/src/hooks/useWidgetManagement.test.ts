import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWidgetManagement } from './useWidgetManagement'

describe('useWidgetManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with empty widgets', () => {
    const { result } = renderHook(() => useWidgetManagement())
    expect(result.current.widgets).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('fetches widgets successfully', async () => {
    const mockWidgets = [
      { id: 1, widget_type: 'summary', title: 'Summary', position: 0, width: 'full', is_visible: true, config: null }
    ]

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockWidgets)
    })

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.fetchWidgets()
    })

    expect(result.current.widgets).toEqual(mockWidgets)
  })

  it('handles fetch error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.fetchWidgets()
    })

    expect(result.current.widgets).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching widgets:', expect.any(Error))
  })

  it('toggles widget visibility', async () => {
    const mockWidgets = [
      { id: 1, widget_type: 'summary', title: 'Summary', position: 0, width: 'full', is_visible: true, config: null }
    ]

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // toggleVisibility call
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWidgets) }) // refetch

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.toggleVisibility(1)
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/widgets/1/visibility', { method: 'PATCH' })
  })

  it('moves widget up', async () => {
    const mockWidgets = [
      { id: 1, widget_type: 'summary', position: 0, width: 'full', is_visible: true, config: null, title: null },
      { id: 2, widget_type: 'velocity', position: 1, width: 'half', is_visible: true, config: null, title: null }
    ]

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWidgets) }) // initial fetch
      .mockResolvedValueOnce({ ok: true }) // moveUp call
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWidgets) }) // refetch

    const { result } = renderHook(() => useWidgetManagement())

    // First fetch widgets
    await act(async () => {
      await result.current.fetchWidgets()
    })

    // Then move widget 2 up
    await act(async () => {
      await result.current.moveUp(2)
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/layout', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }))
  })

  it('does not move first widget up', async () => {
    const mockWidgets = [
      { id: 1, widget_type: 'summary', position: 0, width: 'full', is_visible: true, config: null, title: null }
    ]

    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockWidgets) })

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.fetchWidgets()
    })

    const fetchCallCount = (fetch as any).mock.calls.length

    await act(async () => {
      await result.current.moveUp(1)
    })

    // Should not have made additional fetch calls
    expect((fetch as any).mock.calls.length).toBe(fetchCallCount)
  })

  it('resets widgets', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // reset call
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // refetch

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.reset()
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/reset', { method: 'POST' })
  })

  it('duplicates widget', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // duplicate call
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // refetch

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.duplicate(1)
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/widgets/1/duplicate', { method: 'POST' })
  })

  it('updates widget', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // update call
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // refetch

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.updateWidget(1, 'New Title', { buckets: ['groceries'] })
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/widgets/1', expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }))
  })

  it('deletes widget', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // delete call
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // refetch

    const { result } = renderHook(() => useWidgetManagement())

    await act(async () => {
      await result.current.deleteWidget(1)
    })

    expect(fetch).toHaveBeenCalledWith('/api/v1/dashboard/widgets/1', { method: 'DELETE' })
  })
})
