// Types for dashboard configuration

export interface Widget {
  id: number
  widget_type: string
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
  nameKey: string  // Translation key for widget name (e.g., 'summary', 'velocity')
  descriptionKey: string  // Translation key for description (e.g., 'summary', 'velocity')
  supportsFilter: boolean
  canDuplicate: boolean
}

// Widget metadata with translation keys
// Names use keys from dashboard.widgets.* (e.g., dashboard.widgets.summary)
// Descriptions use keys from dashboard.widgets.descriptions.* (e.g., dashboard.widgets.descriptions.summary)
export const WIDGET_INFO: Record<string, WidgetInfo> = {
  summary: {
    icon: '📊',
    nameKey: 'summary',
    descriptionKey: 'summary',
    supportsFilter: false,
    canDuplicate: false
  },
  velocity: {
    icon: '🔥',
    nameKey: 'velocity',
    descriptionKey: 'velocity',
    supportsFilter: false,
    canDuplicate: false
  },
  anomalies: {
    icon: '⚠️',
    nameKey: 'anomalies',
    descriptionKey: 'anomalies',
    supportsFilter: false,
    canDuplicate: false
  },
  bucket_pie: {
    icon: '🥧',
    nameKey: 'bucketPie',
    descriptionKey: 'bucketPie',
    supportsFilter: false,
    canDuplicate: false
  },
  top_merchants: {
    icon: '🏪',
    nameKey: 'topMerchants',
    descriptionKey: 'topMerchants',
    supportsFilter: true,
    canDuplicate: true
  },
  trends: {
    icon: '📈',
    nameKey: 'trends',
    descriptionKey: 'trends',
    supportsFilter: true,
    canDuplicate: false
  },
  sankey: {
    icon: '🌊',
    nameKey: 'sankey',
    descriptionKey: 'sankey',
    supportsFilter: true,
    canDuplicate: true
  },
  treemap: {
    icon: '🗺️',
    nameKey: 'treemap',
    descriptionKey: 'treemap',
    supportsFilter: true,
    canDuplicate: true
  },
  heatmap: {
    icon: '🗓️',
    nameKey: 'heatmap',
    descriptionKey: 'heatmap',
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
