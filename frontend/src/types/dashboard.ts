// Types for dashboard configuration

export interface Widget {
  id: number
  widget_type: string
  title: string | null
  position: number
  width: string
  is_visible: boolean
  config: string | null
}

export interface Bucket {
  id: number
  value: string
}

export interface FilterOption {
  value: string
  count: number
}

export interface WidgetConfig {
  buckets?: string[]
  accounts?: string[]
  merchants?: string[]
}

export interface WidgetInfo {
  icon: string
  name: string
  description: string
  supportsFilter: boolean
  canDuplicate: boolean
}

// Widget metadata for descriptions and help
export const WIDGET_INFO: Record<string, WidgetInfo> = {
  summary: {
    icon: '📊',
    name: 'Summary',
    description: 'Shows total income, expenses, and net for the period. Includes month-over-month comparison.',
    supportsFilter: false,
    canDuplicate: false
  },
  velocity: {
    icon: '🔥',
    name: 'Spending Velocity',
    description: 'Daily burn rate showing if you\'re on track for your typical monthly spending.',
    supportsFilter: false,
    canDuplicate: false
  },
  anomalies: {
    icon: '⚠️',
    name: 'Anomalies',
    description: 'Highlights unusual transactions that deviate significantly from your normal spending patterns.',
    supportsFilter: false,
    canDuplicate: false
  },
  bucket_pie: {
    icon: '🥧',
    name: 'Spending by Bucket',
    description: 'Pie chart showing how spending is distributed across your budget buckets.',
    supportsFilter: false,
    canDuplicate: false
  },
  top_merchants: {
    icon: '🏪',
    name: 'Top Merchants',
    description: 'List of merchants where you spend the most. Can be filtered by bucket to see top merchants within a category.',
    supportsFilter: true,
    canDuplicate: true
  },
  trends: {
    icon: '📈',
    name: 'Trends',
    description: 'Line chart showing income, expenses, and net over time. Shows 12 weeks in month view, 12 months in year view.',
    supportsFilter: true,
    canDuplicate: false
  },
  sankey: {
    icon: '🌊',
    name: 'Money Flow',
    description: 'Flow diagram showing how money moves from income sources through accounts to spending categories. Great for understanding overall cash flow.',
    supportsFilter: true,
    canDuplicate: true
  },
  treemap: {
    icon: '🗺️',
    name: 'Spending Breakdown',
    description: 'Hierarchical view of spending by category and merchant. Larger boxes = more spending. Click to explore.',
    supportsFilter: true,
    canDuplicate: true
  },
  heatmap: {
    icon: '🗓️',
    name: 'Spending Calendar',
    description: 'Calendar heatmap showing daily spending intensity. Darker = more spent. Click months in year view to drill down.',
    supportsFilter: true,
    canDuplicate: true
  }
}

export function parseWidgetConfig(config: string | null): WidgetConfig {
  if (!config) return {}
  try {
    return JSON.parse(config)
  } catch {
    return {}
  }
}
