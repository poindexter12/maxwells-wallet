import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SankeyFlowChart } from './SankeyFlowChart'
import { SankeyData } from './types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}))

// Mock Recharts
vi.mock('recharts', () => ({
  Sankey: () => <div data-testid="sankey" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>
}))

describe('SankeyFlowChart', () => {
  const mockSankeyData: SankeyData = {
    nodes: [
      { name: 'Income' },
      { name: 'Checking' },
      { name: 'Groceries' },
      { name: 'Entertainment' }
    ],
    links: [
      { source: 0, target: 1, value: 5000 },
      { source: 1, target: 2, value: 2000 },
      { source: 1, target: 3, value: 1000 }
    ]
  }

  it('renders sankey chart with data', () => {
    render(<SankeyFlowChart data={mockSankeyData} />)

    expect(screen.getByText('sankey')).toBeInTheDocument()
    expect(screen.getByTestId('sankey')).toBeInTheDocument()
  })

  it('renders responsive container', () => {
    render(<SankeyFlowChart data={mockSankeyData} />)

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('shows empty state when no nodes', () => {
    const emptyData: SankeyData = { nodes: [], links: [] }

    render(<SankeyFlowChart data={emptyData} />)

    expect(screen.getByText('sankey')).toBeInTheDocument()
    expect(screen.getByText('noSpendingData')).toBeInTheDocument()
    expect(screen.queryByTestId('sankey')).not.toBeInTheDocument()
  })

  it('returns null when data is null', () => {
    const { container } = render(<SankeyFlowChart data={null} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders with widget prop', () => {
    const widget = {
      id: 1,
      widget_type: 'sankey',
      position: 0,
      width: 'full',
      is_visible: true,
      config: null
    }

    render(<SankeyFlowChart widget={widget} data={mockSankeyData} />)

    expect(screen.getByTestId('sankey')).toBeInTheDocument()
  })
})
