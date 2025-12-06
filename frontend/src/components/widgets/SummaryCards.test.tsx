import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryCards } from './SummaryCards'

describe('SummaryCards', () => {
  const baseSummary = {
    total_income: 5000,
    total_expenses: 3500,
    net: 1500
  }

  it('renders income, expenses, and net', () => {
    render(<SummaryCards summary={baseSummary} />)

    expect(screen.getByText('Total Income')).toBeInTheDocument()
    expect(screen.getByText('Total Expenses')).toBeInTheDocument()
    expect(screen.getByText('Net')).toBeInTheDocument()
  })

  it('displays formatted currency values', () => {
    render(<SummaryCards summary={baseSummary} />)

    expect(screen.getByText('$5,000.00')).toBeInTheDocument()
    expect(screen.getByText('$3,500.00')).toBeInTheDocument()
    expect(screen.getByText('$1,500.00')).toBeInTheDocument()
  })

  it('applies positive styling to income', () => {
    render(<SummaryCards summary={baseSummary} />)

    const incomeValue = screen.getByText('$5,000.00')
    expect(incomeValue).toHaveClass('text-positive')
  })

  it('applies negative styling to expenses', () => {
    render(<SummaryCards summary={baseSummary} />)

    const expenseValue = screen.getByText('$3,500.00')
    expect(expenseValue).toHaveClass('text-negative')
  })

  it('applies positive styling to positive net', () => {
    render(<SummaryCards summary={baseSummary} />)

    const netValue = screen.getByText('$1,500.00')
    expect(netValue).toHaveClass('text-positive')
  })

  it('applies negative styling to negative net', () => {
    const negativeSummary = { ...baseSummary, net: -500 }
    render(<SummaryCards summary={negativeSummary} />)

    const netValue = screen.getByText('-$500.00')
    expect(netValue).toHaveClass('text-negative')
  })

  it('renders without month-over-month data', () => {
    render(<SummaryCards summary={baseSummary} />)

    expect(screen.queryByText(/vs last month/)).not.toBeInTheDocument()
  })

  it('renders month-over-month comparisons when provided', () => {
    const monthOverMonth = {
      changes: {
        income: { amount: 500, percent: 10 },
        expenses: { amount: 200, percent: 5 },
        net: { amount: 300, percent: 8 }
      }
    }

    render(<SummaryCards summary={baseSummary} monthOverMonth={monthOverMonth} />)

    expect(screen.getByText('+10.0% vs last month')).toBeInTheDocument()
    expect(screen.getByText('+5.0% vs last month')).toBeInTheDocument()
    expect(screen.getByText('+8.0% vs last month')).toBeInTheDocument()
  })

  it('shows negative change correctly', () => {
    const monthOverMonth = {
      changes: {
        income: { amount: -200, percent: -5 },
        expenses: { amount: -100, percent: -3 },
        net: { amount: -100, percent: -2 }
      }
    }

    render(<SummaryCards summary={baseSummary} monthOverMonth={monthOverMonth} />)

    expect(screen.getByText('-5.0% vs last month')).toBeInTheDocument()
  })

  it('handles zero values', () => {
    const zeroSummary = {
      total_income: 0,
      total_expenses: 0,
      net: 0
    }

    render(<SummaryCards summary={zeroSummary} />)

    expect(screen.getAllByText('$0.00')).toHaveLength(3)
  })
})
