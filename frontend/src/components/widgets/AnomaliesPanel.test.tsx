import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnomaliesPanel } from './AnomaliesPanel'
import { AnomaliesData } from './types'

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

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}))

describe('AnomaliesPanel', () => {
  const mockAnomalies: AnomaliesData = {
    summary: {
      total_anomalies: 8,
      large_transaction_count: 3,
      new_merchant_count: 2,
      unusual_bucket_count: 3,
      large_threshold_amount: 250
    },
    anomalies: {
      large_transactions: [
        { amount: 500, merchant: 'Expensive Store', reason: 'Well above average' },
        { amount: 350, merchant: 'Premium Service', reason: 'Above threshold' },
        { amount: 300, merchant: 'Luxury Brand', reason: 'Unusual purchase' }
      ],
      new_merchants: [
        { amount: 150, merchant: 'New Coffee Shop', reason: 'First transaction' },
        { amount: 80, merchant: 'New Restaurant', reason: 'First transaction' }
      ],
      unusual_buckets: [
        { bucket: 'Entertainment', reason: 'Spending 150% above average' },
        { bucket: 'Dining', reason: 'Spending 120% above average' },
        { bucket: 'Shopping', reason: 'Spending 110% above average' }
      ]
    }
  }

  it('renders anomalies summary counts', () => {
    render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={2024} selectedMonth={12} />)

    expect(screen.getByText('anomalies')).toBeInTheDocument()
    // large_transaction_count and unusual_bucket_count are both 3, so use getAllByText
    const threes = screen.getAllByText('3')
    expect(threes.length).toBe(2) // large transactions + unusual buckets
    expect(screen.getByText('2')).toBeInTheDocument() // new merchants
  })

  it('renders large transaction anomalies', () => {
    render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={2024} selectedMonth={12} />)

    expect(screen.getByText(/Expensive Store/)).toBeInTheDocument()
    expect(screen.getByText(/\$500\.00/)).toBeInTheDocument()
    expect(screen.getByText(/Well above average/)).toBeInTheDocument()
  })

  it('renders new merchant anomalies', () => {
    render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={2024} selectedMonth={12} />)

    expect(screen.getByText(/New Coffee Shop/)).toBeInTheDocument()
    expect(screen.getByText(/\$150\.00/)).toBeInTheDocument()
  })

  it('renders unusual bucket anomalies', () => {
    render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={2024} selectedMonth={12} />)

    expect(screen.getByText('Entertainment')).toBeInTheDocument()
    expect(screen.getByText(/Spending 150% above average/)).toBeInTheDocument()
  })

  it('shows no anomalies message when summary total is zero', () => {
    const emptyAnomalies: AnomaliesData = {
      summary: {
        total_anomalies: 0,
        large_transaction_count: 0,
        new_merchant_count: 0,
        unusual_bucket_count: 0
      },
      anomalies: {
        large_transactions: [],
        new_merchants: [],
        unusual_buckets: []
      }
    }

    render(<AnomaliesPanel anomalies={emptyAnomalies} selectedYear={2024} selectedMonth={12} />)

    expect(screen.getByText('noAnomalies')).toBeInTheDocument()
  })

  it('returns null when anomalies data is null', () => {
    const { container } = render(<AnomaliesPanel anomalies={null} selectedYear={2024} selectedMonth={12} />)

    expect(container.firstChild).toBeNull()
  })

  it('returns null when year is invalid', () => {
    const { container } = render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={NaN} selectedMonth={12} />)

    expect(container.firstChild).toBeNull()
  })

  it('returns null when month is invalid', () => {
    const { container } = render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={2024} selectedMonth={NaN} />)

    expect(container.firstChild).toBeNull()
  })

  it('limits large transactions to 3 items', () => {
    const manyAnomalies: AnomaliesData = {
      ...mockAnomalies,
      anomalies: {
        ...mockAnomalies.anomalies,
        large_transactions: [
          { amount: 500, merchant: 'Store 1', reason: 'Reason 1' },
          { amount: 450, merchant: 'Store 2', reason: 'Reason 2' },
          { amount: 400, merchant: 'Store 3', reason: 'Reason 3' },
          { amount: 350, merchant: 'Store 4', reason: 'Reason 4' },
          { amount: 300, merchant: 'Store 5', reason: 'Reason 5' }
        ]
      }
    }

    render(<AnomaliesPanel anomalies={manyAnomalies} selectedYear={2024} selectedMonth={12} />)

    // Should only show first 3
    expect(screen.getByText(/Store 1/)).toBeInTheDocument()
    expect(screen.getByText(/Store 2/)).toBeInTheDocument()
    expect(screen.getByText(/Store 3/)).toBeInTheDocument()
    expect(screen.queryByText(/Store 4/)).not.toBeInTheDocument()
  })

  it('generates correct transaction filter links', () => {
    render(<AnomaliesPanel anomalies={mockAnomalies} selectedYear={2024} selectedMonth={12} />)

    const links = screen.getAllByRole('link')
    const largeLink = links.find(l => l.getAttribute('href')?.includes('amount_max'))

    expect(largeLink).toBeDefined()
    expect(largeLink?.getAttribute('href')).toContain('start_date=2024-12-01')
    expect(largeLink?.getAttribute('href')).toContain('end_date=2024-12-31')
  })
})
