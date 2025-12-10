// Types for import page

export interface AccountTag {
  id: number
  namespace: string
  value: string
}

export interface SavedCustomFormat {
  id: number
  name: string
  description: string | null
  config_json: string
  use_count: number
}

export interface PreviewTransaction {
  date: string
  amount: number
  description: string
  merchant?: string
  bucket?: string
}

export interface FilePreview {
  filename: string
  account_source: string | null
  detected_format: string
  transaction_count: number
  duplicate_count: number
  cross_file_duplicate_count: number
  total_amount: number
  date_range_start: string | null
  date_range_end: string | null
  transactions: PreviewTransaction[]
  selected: boolean
  accountSourceOverride?: string
}

export interface ImportResult {
  imported?: number
  duplicates?: number
  total_imported?: number
  total_duplicates?: number
  format_saved?: boolean
  config_saved?: boolean
  files?: Array<{
    filename: string
    imported: number
    duplicates: number
  }>
  cross_account_warning_count?: number
}

// Single file preview response from API
export interface SingleFilePreviewResponse {
  filename: string
  account_source: string | null
  detected_format: string
  format_confidence: number
  transaction_count: number
  duplicate_count: number
  total_amount: number
  date_range_start: string | null
  date_range_end: string | null
  transactions: PreviewTransaction[]
  needs_custom_config?: boolean
  headers?: string[]
  sample_rows?: string[][]
}

export const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'Bank of America (Checking/Savings)',
  'bofa_cc': 'Bank of America (Credit Card)',
  'amex_cc': 'American Express',
  'inspira_hsa': 'Inspira HSA',
  'venmo': 'Venmo',
  'qif': 'Quicken (QIF)',
  'qfx': 'Quicken/OFX (QFX)',
  'custom': 'Custom Format',
  'unknown': 'Unknown'
}
