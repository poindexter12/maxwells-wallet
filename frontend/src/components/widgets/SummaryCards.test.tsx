import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryCards } from './SummaryCards'
import { TEST_IDS } from '@/test-ids'

describe('SummaryCards', () => {
  const baseSummary = {
    total_income: 5000,
    total_expenses: 3500,
    net: 1500
  }

  it('renders income, expenses, and net cards', () => {
    render(<SummaryCards summary={baseSummary} />)

    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_INCOME)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_EXPENSES)).toBeInTheDocument()
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_NET)).toBeInTheDocument()
  })

  it('displays formatted currency values', () => {
    render(<SummaryCards summary={baseSummary} />)

    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_INCOME_VALUE)).toHaveTextContent('$5,000.00')
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_EXPENSES_VALUE)).toHaveTextContent('$3,500.00')
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_NET_VALUE)).toHaveTextContent('$1,500.00')
  })

  it('applies positive styling to income', () => {
    render(<SummaryCards summary={baseSummary} />)

    const incomeValue = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_INCOME_VALUE)
    expect(incomeValue).toHaveClass('text-positive')
  })

  it('applies negative styling to expenses', () => {
    render(<SummaryCards summary={baseSummary} />)

    const expenseValue = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_EXPENSES_VALUE)
    expect(expenseValue).toHaveClass('text-negative')
  })

  it('applies positive styling to positive net', () => {
    render(<SummaryCards summary={baseSummary} />)

    const netValue = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_NET_VALUE)
    expect(netValue).toHaveClass('text-positive')
  })

  it('applies negative styling to negative net', () => {
    const negativeSummary = { ...baseSummary, net: -500 }
    render(<SummaryCards summary={negativeSummary} />)

    const netValue = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_NET_VALUE)
    expect(netValue).toHaveClass('text-negative')
    expect(netValue).toHaveTextContent('-$500.00')
  })

  it('renders without month-over-month data', () => {
    render(<SummaryCards summary={baseSummary} />)

    // Cards should exist but no MoM comparison text
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_CARDS)).toBeInTheDocument()
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

    // Check that MoM data is rendered within the cards
    const incomeCard = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_INCOME)
    const expensesCard = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_EXPENSES)
    const netCard = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_NET)

    expect(incomeCard).toHaveTextContent('+10.0%')
    expect(expensesCard).toHaveTextContent('+5.0%')
    expect(netCard).toHaveTextContent('+8.0%')
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

    const incomeCard = screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_INCOME)
    expect(incomeCard).toHaveTextContent('-5.0%')
  })

  it('handles zero values', () => {
    const zeroSummary = {
      total_income: 0,
      total_expenses: 0,
      net: 0
    }

    render(<SummaryCards summary={zeroSummary} />)

    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_INCOME_VALUE)).toHaveTextContent('$0.00')
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_EXPENSES_VALUE)).toHaveTextContent('$0.00')
    expect(screen.getByTestId(TEST_IDS.WIDGET_SUMMARY_NET_VALUE)).toHaveTextContent('$0.00')
  })
})
