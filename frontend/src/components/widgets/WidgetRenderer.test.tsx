import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WidgetRenderer } from './WidgetRenderer'
import { Widget, SummaryData } from './types'

// Mock all child widget components
vi.mock('./SummaryCards', () => ({
  SummaryCards: ({ summary }: any) => <div data-testid="summary-cards">SummaryCards: {summary.net}</div>
}))

vi.mock('./SpendingVelocity', () => ({
  SpendingVelocity: () => <div data-testid="spending-velocity">SpendingVelocity</div>
}))

vi.mock('./AnomaliesPanel', () => ({
  AnomaliesPanel: () => <div data-testid="anomalies-panel">AnomaliesPanel</div>
}))

vi.mock('./BucketPieChart', () => ({
  BucketPieChart: () => <div data-testid="bucket-pie-chart">BucketPieChart</div>
}))

vi.mock('./TopMerchantsList', () => ({
  TopMerchantsList: ({ data }: any) => <div data-testid="top-merchants-list">TopMerchantsList</div>
}))

vi.mock('./TrendsChart', () => ({
  TrendsChart: () => <div data-testid="trends-chart">TrendsChart</div>
}))

vi.mock('./SankeyFlowChart', () => ({
  SankeyFlowChart: () => <div data-testid="sankey-flow-chart">SankeyFlowChart</div>
}))

vi.mock('./SpendingTreemap', () => ({
  SpendingTreemap: () => <div data-testid="spending-treemap">SpendingTreemap</div>
}))

vi.mock('./SpendingHeatmap', () => ({
  SpendingHeatmap: () => <div data-testid="spending-heatmap">SpendingHeatmap</div>
}))

const mockSummary: SummaryData = {
  total_income: 5000,
  total_expenses: 3000,
  net: 2000
}

const baseWidget: Widget = {
  id: 1,
  widget_type: 'summary',
  title: null,
  position: 0,
  width: 'full',
  is_visible: true,
  config: null
}

const defaultProps = {
  widget: baseWidget,
  summary: mockSummary,
  monthOverMonth: null,
  spendingVelocity: null,
  anomalies: null,
  trends: null,
  topMerchants: null,
  sankeyData: null,
  treemapData: null,
  heatmapData: null,
  isMonthlyScale: true,
  selectedYear: 2024,
  selectedMonth: 1,
  bucketData: []
}

describe('WidgetRenderer', () => {
  it('renders SummaryCards for summary widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'summary' }} />)

    expect(screen.getByTestId('summary-cards')).toBeInTheDocument()
  })

  it('renders SpendingVelocity for velocity widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'velocity' }} />)

    expect(screen.getByTestId('spending-velocity')).toBeInTheDocument()
  })

  it('renders AnomaliesPanel for anomalies widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'anomalies' }} />)

    expect(screen.getByTestId('anomalies-panel')).toBeInTheDocument()
  })

  it('renders BucketPieChart for bucket_pie widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'bucket_pie' }} />)

    expect(screen.getByTestId('bucket-pie-chart')).toBeInTheDocument()
  })

  it('renders TopMerchantsList for top_merchants widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'top_merchants' }} />)

    expect(screen.getByTestId('top-merchants-list')).toBeInTheDocument()
  })

  it('renders TrendsChart for trends widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'trends' }} />)

    expect(screen.getByTestId('trends-chart')).toBeInTheDocument()
  })

  it('renders SankeyFlowChart for sankey widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'sankey' }} />)

    expect(screen.getByTestId('sankey-flow-chart')).toBeInTheDocument()
  })

  it('renders SpendingTreemap for treemap widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'treemap' }} />)

    expect(screen.getByTestId('spending-treemap')).toBeInTheDocument()
  })

  it('renders SpendingHeatmap for heatmap widget type', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'heatmap' }} />)

    expect(screen.getByTestId('spending-heatmap')).toBeInTheDocument()
  })

  it('returns null for unknown widget type', () => {
    const { container } = render(
      <WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'unknown_type' }} />
    )

    expect(container.firstChild).toBeNull()
  })

  it('passes summary data to SummaryCards', () => {
    render(<WidgetRenderer {...defaultProps} widget={{ ...baseWidget, widget_type: 'summary' }} />)

    expect(screen.getByText('SummaryCards: 2000')).toBeInTheDocument()
  })

  it('uses customData when provided for top_merchants', () => {
    const customData = { merchants: [{ merchant: 'Custom Merchant', amount: 100 }] }
    render(
      <WidgetRenderer
        {...defaultProps}
        widget={{ ...baseWidget, widget_type: 'top_merchants' }}
        customData={customData}
      />
    )

    expect(screen.getByTestId('top-merchants-list')).toBeInTheDocument()
  })

  it('uses customData when provided for trends', () => {
    const customData = { data: [], group_by: 'month' }
    render(
      <WidgetRenderer
        {...defaultProps}
        widget={{ ...baseWidget, widget_type: 'trends' }}
        customData={customData}
      />
    )

    expect(screen.getByTestId('trends-chart')).toBeInTheDocument()
  })

  it('uses customData when provided for sankey', () => {
    const customData = { nodes: [], links: [] }
    render(
      <WidgetRenderer
        {...defaultProps}
        widget={{ ...baseWidget, widget_type: 'sankey' }}
        customData={customData}
      />
    )

    expect(screen.getByTestId('sankey-flow-chart')).toBeInTheDocument()
  })

  it('uses customData when provided for treemap', () => {
    const customData = { children: [] }
    render(
      <WidgetRenderer
        {...defaultProps}
        widget={{ ...baseWidget, widget_type: 'treemap' }}
        customData={customData}
      />
    )

    expect(screen.getByTestId('spending-treemap')).toBeInTheDocument()
  })

  it('uses customData when provided for heatmap', () => {
    const customData = { data: [] }
    render(
      <WidgetRenderer
        {...defaultProps}
        widget={{ ...baseWidget, widget_type: 'heatmap' }}
        customData={customData}
      />
    )

    expect(screen.getByTestId('spending-heatmap')).toBeInTheDocument()
  })
})
