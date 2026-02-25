import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrendsChart } from './TrendsChart'
import { TrendsData } from './types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}))

// Mock useFormat hook
vi.mock('@/hooks/useFormat', () => ({
  useFormat: () => ({
    formatCurrency: (value: number) => `$${value.toFixed(2)}`,
    formatCompactCurrency: (value: number) => `$${Math.round(value)}`
  })
}))

// Mock Recharts
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>
}))

describe('TrendsChart', () => {
  const mockWeeklyTrends: TrendsData = {
    group_by: 'week',
    data: [
      { period: '2024-W01', income: 1000, expenses: 800, net: 200 },
      { period: '2024-W02', income: 1100, expenses: 850, net: 250 },
      { period: '2024-W03', income: 1050, expenses: 900, net: 150 }
    ]
  }

  const mockMonthlyTrends: TrendsData = {
    group_by: 'month',
    data: [
      { period: '2024-01', income: 5000, expenses: 4000, net: 1000 },
      { period: '2024-02', income: 5500, expenses: 4200, net: 1300 },
      { period: '2024-03', income: 5200, expenses: 4500, net: 700 }
    ]
  }

  it('renders trends chart with weekly data', () => {
    render(<TrendsChart data={mockWeeklyTrends} isMonthlyScale={true} />)

    expect(screen.getByText('trends')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders trends chart with monthly data', () => {
    render(<TrendsChart data={mockMonthlyTrends} isMonthlyScale={false} />)

    expect(screen.getByText('trends')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('returns null when trends data is missing', () => {
    const { container } = render(<TrendsChart data={null} isMonthlyScale={true} />)

    expect(container.firstChild).toBeNull()
  })

  it('returns null when data array is empty', () => {
    const emptyTrends: TrendsData = {
      group_by: 'week',
      data: []
    }

    const { container } = render(<TrendsChart data={emptyTrends} isMonthlyScale={true} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders chart components', () => {
    render(<TrendsChart data={mockWeeklyTrends} isMonthlyScale={true} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    expect(screen.getByTestId('x-axis')).toBeInTheDocument()
    expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    expect(screen.getByTestId('legend')).toBeInTheDocument()
  })
})
