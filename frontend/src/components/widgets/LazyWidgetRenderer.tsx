'use client'

import { Widget } from './types'
import {
  LazySummaryCards,
  LazySpendingVelocity,
  LazyAnomaliesPanel,
  LazyBucketPieChart,
  LazyTopMerchantsList,
  LazyTrendsChart,
  LazySankeyFlowChart,
  LazySpendingTreemap,
  LazySpendingHeatmap
} from './LazyWidgets'

interface LazyWidgetRendererProps {
  widget: Widget
}

/**
 * LazyWidgetRenderer - Renders widgets that fetch their own data.
 * Each widget handles its own loading state and data fetching via SWR hooks.
 * This enables progressive loading where widgets render as their data becomes available.
 */
export function LazyWidgetRenderer({ widget }: LazyWidgetRendererProps) {
  switch (widget.widget_type) {
    case 'summary':
      return <LazySummaryCards />

    case 'velocity':
      return <LazySpendingVelocity widget={widget} />

    case 'anomalies':
      return <LazyAnomaliesPanel widget={widget} />

    case 'bucket_pie':
      return <LazyBucketPieChart widget={widget} />

    case 'top_merchants':
      return <LazyTopMerchantsList widget={widget} />

    case 'trends':
      return <LazyTrendsChart widget={widget} />

    case 'sankey':
      return <LazySankeyFlowChart widget={widget} />

    case 'treemap':
      return <LazySpendingTreemap widget={widget} />

    case 'heatmap':
      return <LazySpendingHeatmap widget={widget} />

    default:
      return null
  }
}
