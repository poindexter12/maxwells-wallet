import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendingVelocity } from './SpendingVelocity'
import { SummaryData, SpendingVelocityData } from './types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}))

// Mock useFormat hook
vi.mock('@/hooks/useFormat', () => ({
  useFormat: () => ({
    formatCurrency: (value: number) => `$${value.toFixed(2)}`
  })
}))

describe('SpendingVelocity', () => {
  const mockSummary: SummaryData = {
    total_income: 5000,
    total_expenses: 3500,
    net: 1500,
    daily_average: 116.67,
    days_elapsed: 30,
    transaction_count: 150
  }

  const mockVelocityData: SpendingVelocityData = {
    days_elapsed: 15,
    days_in_month: 30,
    pace: 'on_track',
    insights: {
      daily_burn_rate: '$116.67',
      days_remaining: 15,
      projected_remaining_spending: 1750
    },
    projected_monthly: {
      expenses: 3500
    },
    previous_month: {
      expenses: 3400
    }
  }

  describe('Monthly scale view', () => {
    it('renders monthly velocity data', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={mockVelocityData}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('velocity')).toBeInTheDocument()
      expect(screen.getByText('dailySpendingRate')).toBeInTheDocument()
      expect(screen.getByText('$116.67')).toBeInTheDocument()
    })

    it('renders days elapsed and remaining', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={mockVelocityData}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('daysElapsed')).toBeInTheDocument()
      expect(screen.getByText('15 / 30')).toBeInTheDocument()
      expect(screen.getByText('daysRemaining')).toBeInTheDocument()
      expect(screen.getByText('15')).toBeInTheDocument()
    })

    it('renders projected monthly total', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={mockVelocityData}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('projectedMonthTotal')).toBeInTheDocument()
      expect(screen.getByText('$3500.00')).toBeInTheDocument()
    })

    it('shows on track status', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={mockVelocityData}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('onTrack')).toBeInTheDocument()
    })

    it('shows over budget status', () => {
      const overBudgetData = { ...mockVelocityData, pace: 'over_budget' as const }
      render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={overBudgetData}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('overBudget')).toBeInTheDocument()
    })

    it('shows under budget status', () => {
      const underBudgetData = { ...mockVelocityData, pace: 'under_budget' as const }
      render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={underBudgetData}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('underBudget')).toBeInTheDocument()
    })

    it('returns null when velocity data is missing', () => {
      const { container } = render(
        <SpendingVelocity
          isMonthlyScale={true}
          summary={mockSummary}
          spendingVelocity={null}
          selectedYear={2024}
        />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Yearly scale view', () => {
    it('renders annual velocity from summary', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={false}
          summary={mockSummary}
          spendingVelocity={null}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('velocity')).toBeInTheDocument()
      expect(screen.getByText('dailyAverage')).toBeInTheDocument()
      expect(screen.getByText(/\$116\.67/)).toBeInTheDocument()
    })

    it('renders annual statistics', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={false}
          summary={mockSummary}
          spendingVelocity={null}
          selectedYear={2024}
        />
      )

      expect(screen.getByText('totalSpending')).toBeInTheDocument()
      expect(screen.getByText('$3500.00')).toBeInTheDocument()
      expect(screen.getByText('transactions')).toBeInTheDocument()
      expect(screen.getByText('150')).toBeInTheDocument()
    })

    it('handles invalid year gracefully', () => {
      render(
        <SpendingVelocity
          isMonthlyScale={false}
          summary={mockSummary}
          spendingVelocity={null}
          selectedYear={NaN}
        />
      )

      // Should still render with fallback to current year
      expect(screen.getByText('velocity')).toBeInTheDocument()
    })
  })
})
