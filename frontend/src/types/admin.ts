// Types for admin page

export const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'BofA Bank',
  'bofa_cc': 'BofA CC',
  'amex_cc': 'Amex CC',
  'inspira_hsa': 'Inspira HSA',
  'venmo': 'Venmo',
  'unknown': 'Unknown'
}

export interface ImportSession {
  id: number
  filename: string
  format_type: string
  account_source: string | null
  transaction_count: number
  duplicate_count: number
  total_amount: number
  date_range_start: string | null
  date_range_end: string | null
  status: string
  created_at: string
}

export interface AdminStats {
  total_transactions: number
  account_stats: Array<{ account: string; count: number; total: number }>
  total_import_sessions: number
  import_session_status: Record<string, number>
}

export interface Tag {
  id: number
  namespace: string
  value: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface TagWithUsage extends Tag {
  usage_count?: number
}

export type AdminTab = 'overview' | 'imports' | 'health' | 'backups' | 'all-tags' | 'buckets' | 'accounts' | 'occasions' | 'expense-types'

// Backup types
export interface BackupMetadata {
  id: string
  filename: string
  description: string
  created_at: string
  size_bytes: number
  is_demo_backup: boolean
  source: 'manual' | 'scheduled' | 'pre_import' | 'demo_seed'
  db_version: string | null
}

export interface SchedulerSettings {
  auto_backup_enabled: boolean
  auto_backup_interval_hours: number
  demo_reset_interval_hours: number
  next_auto_backup: string | null
  next_demo_reset: string | null
}

// Health/Observability types
export interface LatencyPercentiles {
  p50: number
  p95: number
  p99: number
}

export interface ErrorRates {
  last_hour: number
  last_24h: number
}

export interface DatabaseHealth {
  status: 'up' | 'down'
  latency_ms: number | null
  error: string | null
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: DatabaseHealth
  version: string
}

export interface HealthStats {
  status: 'healthy' | 'degraded' | 'unhealthy'
  request_latency: LatencyPercentiles
  error_rate: ErrorRates
  active_requests: number
  uptime_seconds: number
  slow_query_count: number
  total_requests: number
}

export interface TagTabConfig {
  id: AdminTab
  namespace: string | null
  labelKey: string  // Translation key for label
  descriptionKey: string  // Translation key for description
  showNamespace: boolean
}

export const TAG_TABS: TagTabConfig[] = [
  { id: 'all-tags', namespace: null, labelKey: 'allTagsLabel', descriptionKey: 'allTagsDescription', showNamespace: true },
  { id: 'buckets', namespace: 'bucket', labelKey: 'bucketsLabel', descriptionKey: 'bucketsDescription', showNamespace: false },
  { id: 'accounts', namespace: 'account', labelKey: 'accountsLabel', descriptionKey: 'accountsDescription', showNamespace: false },
  { id: 'occasions', namespace: 'occasion', labelKey: 'occasionsLabel', descriptionKey: 'occasionsDescription', showNamespace: false },
  { id: 'expense-types', namespace: 'expense', labelKey: 'expenseTypesLabel', descriptionKey: 'expenseTypesDescription', showNamespace: false },
]
