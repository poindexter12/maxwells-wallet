import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { DashboardProvider, useDashboard } from './DashboardContext'
import { resetMockDashboards } from '@/test/mocks/handlers'

// Test component that exposes context
function TestConsumer({ onMount }: { onMount?: (ctx: ReturnType<typeof useDashboard>) => void }) {
  const ctx = useDashboard()
  if (onMount) {
    onMount(ctx)
  }
  return (
    <div>
      <div data-testid="loading">{ctx.loading ? 'loading' : 'loaded'}</div>
      <div data-testid="error">{ctx.error || 'no-error'}</div>
      <div data-testid="dashboard-count">{ctx.dashboards.length}</div>
      <div data-testid="current-dashboard">{ctx.currentDashboard?.name || 'none'}</div>
      <ul data-testid="dashboard-list">
        {ctx.dashboards.map(d => (
          <li key={d.id} data-testid={`dashboard-${d.id}`}>{d.name}</li>
        ))}
      </ul>
    </div>
  )
}

describe('DashboardContext', () => {
  beforeEach(() => {
    resetMockDashboards()
  })

  describe('initial loading', () => {
    it('shows loading state initially', async () => {
      render(
        <DashboardProvider>
          <TestConsumer />
        </DashboardProvider>
      )

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading')

      // Wait for load to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })
    })

    it('fetches dashboards on mount', async () => {
      render(
        <DashboardProvider>
          <TestConsumer />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')
      expect(screen.getByTestId('dashboard-1')).toHaveTextContent('Default')
      expect(screen.getByTestId('dashboard-2')).toHaveTextContent('Yearly View')
    })

    it('sets default dashboard as current', async () => {
      render(
        <DashboardProvider>
          <TestConsumer />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('current-dashboard')).toHaveTextContent('Default')
    })
  })

  describe('setCurrentDashboard', () => {
    it('changes the current dashboard', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('current-dashboard')).toHaveTextContent('Default')

      // Change to Yearly View
      act(() => {
        const yearlyDashboard = contextRef!.dashboards.find(d => d.name === 'Yearly View')
        contextRef!.setCurrentDashboard(yearlyDashboard!)
      })

      expect(screen.getByTestId('current-dashboard')).toHaveTextContent('Yearly View')
    })
  })

  describe('createDashboard', () => {
    it('creates a new dashboard', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')

      // Create new dashboard
      await act(async () => {
        await contextRef!.createDashboard({ name: 'New Test Dashboard' })
      })

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-count')).toHaveTextContent('3')
      })
    })

    it('returns the created dashboard', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      let result: unknown
      await act(async () => {
        result = await contextRef!.createDashboard({ name: 'Created Dashboard' })
      })

      expect(result).toMatchObject({
        name: 'Created Dashboard',
        is_default: false,
      })
    })
  })

  describe('updateDashboard', () => {
    it('updates an existing dashboard', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Update dashboard 1
      await act(async () => {
        await contextRef!.updateDashboard(1, { name: 'Updated Default' })
      })

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-1')).toHaveTextContent('Updated Default')
      })
    })

    it('updates current dashboard if it was the one updated', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('current-dashboard')).toHaveTextContent('Default')

      // Update the current dashboard (id: 1)
      await act(async () => {
        await contextRef!.updateDashboard(1, { name: 'Renamed Dashboard' })
      })

      await waitFor(() => {
        expect(screen.getByTestId('current-dashboard')).toHaveTextContent('Renamed Dashboard')
      })
    })
  })

  describe('deleteDashboard', () => {
    it('removes a dashboard', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')

      // Delete dashboard 2
      await act(async () => {
        await contextRef!.deleteDashboard(2)
      })

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-count')).toHaveTextContent('1')
      })

      expect(screen.queryByTestId('dashboard-2')).not.toBeInTheDocument()
    })

    it('returns true on successful delete', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      let result: boolean = false
      await act(async () => {
        result = await contextRef!.deleteDashboard(2)
      })

      expect(result).toBe(true)
    })
  })

  describe('cloneDashboard', () => {
    it('creates a copy of an existing dashboard', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      expect(screen.getByTestId('dashboard-count')).toHaveTextContent('2')

      // Clone dashboard 1
      let cloned: unknown
      await act(async () => {
        cloned = await contextRef!.cloneDashboard(1)
      })

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-count')).toHaveTextContent('3')
      })

      expect(cloned).toMatchObject({
        name: 'Default (Copy)',
        is_default: false,
      })
    })
  })

  describe('setDefaultDashboard', () => {
    it('sets a dashboard as default', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      // Initially dashboard 1 is default
      expect(contextRef!.dashboards.find(d => d.id === 1)?.is_default).toBe(true)
      expect(contextRef!.dashboards.find(d => d.id === 2)?.is_default).toBe(false)

      // Set dashboard 2 as default
      await act(async () => {
        await contextRef!.setDefaultDashboard(2)
      })

      await waitFor(() => {
        expect(contextRef!.dashboards.find(d => d.id === 2)?.is_default).toBe(true)
      })
    })

    it('returns true on success', async () => {
      let contextRef: ReturnType<typeof useDashboard> | null = null

      render(
        <DashboardProvider>
          <TestConsumer onMount={(ctx) => { contextRef = ctx }} />
        </DashboardProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('loaded')
      })

      let result: boolean = false
      await act(async () => {
        result = await contextRef!.setDefaultDashboard(2)
      })

      expect(result).toBe(true)
    })
  })

  describe('error handling', () => {
    it('throws error when useDashboard is used outside provider', () => {
      // Suppress error boundary console output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestConsumer />)
      }).toThrow('useDashboard must be used within a DashboardProvider')

      consoleSpy.mockRestore()
    })
  })
})
