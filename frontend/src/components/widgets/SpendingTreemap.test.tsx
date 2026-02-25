import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendingTreemap } from './SpendingTreemap'
import { TreemapData } from './types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}))

// Mock Recharts
vi.mock('recharts', () => ({
  Treemap: () => <div data-testid="treemap" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>
}))

describe('SpendingTreemap', () => {
  const mockTreemapData: TreemapData = {
    data: {
      name: 'Spending',
      children: [
        {
          name: 'Groceries',
          value: 1500,
          children: [
            { name: 'Whole Foods', value: 800 },
            { name: 'Trader Joes', value: 700 }
          ]
        },
        {
          name: 'Entertainment',
          value: 800,
          children: [
            { name: 'Netflix', value: 500 },
            { name: 'Movie Theater', value: 300 }
          ]
        }
      ]
    }
  }

  it('renders treemap with data', () => {
    render(<SpendingTreemap data={mockTreemapData} />)

    expect(screen.getByText('treemap')).toBeInTheDocument()
    expect(screen.getByText('treemapDescription')).toBeInTheDocument()
    expect(screen.getByTestId('treemap')).toBeInTheDocument()
  })

  it('renders responsive container', () => {
    render(<SpendingTreemap data={mockTreemapData} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('shows empty state when no children', () => {
    const emptyData: TreemapData = {
      data: {
        name: 'Spending',
        children: []
      }
    }

    render(<SpendingTreemap data={emptyData} />)

    expect(screen.getByText('treemap')).toBeInTheDocument()
    expect(screen.getByText('noSpendingDataPeriod')).toBeInTheDocument()
    expect(screen.queryByTestId('treemap')).not.toBeInTheDocument()
  })

  it('returns null when data is null', () => {
    const { container } = render(<SpendingTreemap data={null} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders with widget prop', () => {
    const widget = {
      id: 1,
      widget_type: 'treemap',
      position: 0,
      width: 'full',
      is_visible: true,
      config: null
    }

    render(<SpendingTreemap widget={widget} data={mockTreemapData} />)

    expect(screen.getByTestId('treemap')).toBeInTheDocument()
  })
})
