import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BucketPieChart } from './BucketPieChart'

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

// Mock Recharts (heavy library, not needed for unit tests)
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>
}))

describe('BucketPieChart', () => {
  const mockBucketData = [
    { name: 'Groceries', value: 500, count: 25 },
    { name: 'Entertainment', value: 300, count: 15 },
    { name: 'Dining', value: 200, count: 10 }
  ]

  it('renders pie chart with data', () => {
    render(<BucketPieChart bucketData={mockBucketData} />)

    expect(screen.getByText('bucketPie')).toBeInTheDocument()
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    expect(screen.getByTestId('pie')).toBeInTheDocument()
  })

  it('renders responsive container', () => {
    render(<BucketPieChart bucketData={mockBucketData} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<BucketPieChart bucketData={[]} />)

    expect(screen.getByText('bucketPie')).toBeInTheDocument()
    expect(screen.getByText('noBucketData')).toBeInTheDocument()
    expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument()
  })

  it('renders with widget prop (optional)', () => {
    const widget = {
      id: 1,
      widget_type: 'bucket_pie',
      position: 0,
      width: 'full',
      is_visible: true,
      config: null
    }

    render(<BucketPieChart widget={widget} bucketData={mockBucketData} />)

    expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
  })
})
