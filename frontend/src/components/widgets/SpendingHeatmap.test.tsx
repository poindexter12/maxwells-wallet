import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendingHeatmap } from './SpendingHeatmap'
import { HeatmapData } from './types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}))

// Mock useFormat hook
vi.mock('@/hooks/useFormat', () => ({
  useFormat: () => ({
    formatCurrency: (value: number) => `$${value.toFixed(2)}`,
    formatMonthDay: (month: number, day: number) => `${month}/${day}`,
    getShortWeekdays: () => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  })
}))

describe('SpendingHeatmap', () => {
  const mockDailyHeatmap: HeatmapData = {
    days: [
      { day: 1, weekday: 0, amount: 150, count: 3, intensity: 2 },
      { day: 2, weekday: 1, amount: 200, count: 4, intensity: 3 },
      { day: 3, weekday: 2, amount: 100, count: 2, intensity: 1 }
    ],
    summary: {
      total_spending: 450,
      max_daily: 200,
      days_with_spending: 3
    }
  }

  const mockMonthlyHeatmap: HeatmapData = {
    days: [
      { month: 1, month_name: 'Jan', amount: 3000, count: 50, intensity: 3 },
      { month: 2, month_name: 'Feb', amount: 3500, count: 55, intensity: 4 },
      { month: 3, month_name: 'Mar', amount: 2800, count: 45, intensity: 2 }
    ],
    summary: {
      total_spending: 9300,
      max_monthly: 3500,
      months_with_spending: 3
    }
  }

  describe('Monthly scale (daily view)', () => {
    it('renders heatmap with daily data', () => {
      render(
        <SpendingHeatmap
          data={mockDailyHeatmap}
          isMonthlyScale={true}
          selectedYear={2024}
          selectedMonth={12}
        />
      )

      expect(screen.getByText('heatmap')).toBeInTheDocument()
    })

    it('displays daily summary statistics', () => {
      render(
        <SpendingHeatmap
          data={mockDailyHeatmap}
          isMonthlyScale={true}
          selectedYear={2024}
          selectedMonth={12}
        />
      )

      expect(screen.getByText('total')).toBeInTheDocument()
      expect(screen.getByText('$450.00')).toBeInTheDocument()
      expect(screen.getByText('maxDay')).toBeInTheDocument()
      expect(screen.getByText('$200.00')).toBeInTheDocument()
    })

    it('renders heatmap cells with intensity colors', () => {
      const { container } = render(
        <SpendingHeatmap
          data={mockDailyHeatmap}
          isMonthlyScale={true}
          selectedYear={2024}
          selectedMonth={12}
        />
      )

      // Should have heatmap grid rendered
      expect(container.querySelector('.grid')).toBeInTheDocument()
    })
  })

  describe('Yearly scale (monthly view)', () => {
    it('renders heatmap with monthly data', () => {
      render(
        <SpendingHeatmap
          data={mockMonthlyHeatmap}
          isMonthlyScale={false}
          selectedYear={2024}
          selectedMonth={1}
        />
      )

      expect(screen.getByText('heatmap')).toBeInTheDocument()
    })

    it('displays monthly summary statistics', () => {
      render(
        <SpendingHeatmap
          data={mockMonthlyHeatmap}
          isMonthlyScale={false}
          selectedYear={2024}
          selectedMonth={1}
        />
      )

      expect(screen.getByText('total')).toBeInTheDocument()
      expect(screen.getByText('$9300.00')).toBeInTheDocument()
      expect(screen.getByText('maxMonth')).toBeInTheDocument()
      expect(screen.getByText('$3500.00')).toBeInTheDocument()
      expect(screen.getByText('activeMonths')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  describe('Empty states', () => {
    it('shows empty state when data is null', () => {
      render(
        <SpendingHeatmap
          data={null}
          isMonthlyScale={true}
          selectedYear={2024}
          selectedMonth={12}
        />
      )

      expect(screen.getByText('heatmap')).toBeInTheDocument()
      expect(screen.getByText('noSpendingData')).toBeInTheDocument()
    })

    it('shows empty state when days array is missing', () => {
      const invalidData = { days: undefined, summary: mockDailyHeatmap.summary } as unknown as HeatmapData

      render(
        <SpendingHeatmap
          data={invalidData}
          isMonthlyScale={true}
          selectedYear={2024}
          selectedMonth={12}
        />
      )

      expect(screen.getByText('noSpendingData')).toBeInTheDocument()
    })
  })

  it('renders with widget prop', () => {
    const widget = {
      id: 1,
      widget_type: 'heatmap',
      position: 0,
      width: 'full',
      is_visible: true,
      config: null
    }

    render(
      <SpendingHeatmap
        widget={widget}
        data={mockDailyHeatmap}
        isMonthlyScale={true}
        selectedYear={2024}
        selectedMonth={12}
      />
    )

    expect(screen.getByText('heatmap')).toBeInTheDocument()
  })
})
