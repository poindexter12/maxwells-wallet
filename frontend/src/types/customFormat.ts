// Types for custom CSV format mapping

export interface ColumnHint {
  likely_type: string
  confidence: number
  detected_format?: string
  format_display?: string
  detected_settings?: {
    sign_convention: string
    currency_prefix: string
    invert_sign: boolean
  }
}

export interface AnalysisResult {
  headers: string[]
  sample_rows: string[][]
  column_hints: Record<string, ColumnHint>
  suggested_config: SuggestedConfig
  row_count: number
}

export interface SuggestedConfig {
  name: string
  account_source: string
  date_column: string
  amount_column: string
  description_column: string
  reference_column?: string
  category_column?: string
  date_format: string
  amount_sign_convention: string
  amount_currency_prefix?: string
  amount_invert_sign?: boolean
  _completeness: number
}

export interface CustomConfig {
  name: string
  account_source: string
  date_column: string | number
  amount_column: string | number
  description_column: string | number
  merchant_column?: string | number
  reference_column?: string | number
  category_column?: string | number
  card_member_column?: string | number
  date_format: string
  amount_sign_convention: string
  amount_currency_prefix: string
  amount_invert_sign: boolean
  amount_thousands_separator: string
  row_handling: {
    skip_header_rows: number
    skip_footer_rows: number
    skip_patterns: string[]
    skip_empty_rows: boolean
  }
  merchant_split_chars: string
  merchant_max_length: number
}

export interface PreviewTransaction {
  date: string
  amount: number
  description: string
  merchant: string
  account_source: string
  reference_id: string
}

export interface AccountTag {
  id: number
  namespace: string
  value: string
  description?: string
}

// Format label mappings
export const DATE_FORMAT_LABELS: Record<string, string> = {
  '%m/%d/%Y': 'MM/DD/YYYY',
  '%d/%m/%Y': 'DD/MM/YYYY',
  '%Y-%m-%d': 'YYYY-MM-DD',
  '%m-%d-%Y': 'MM-DD-YYYY',
  '%m/%d/%y': 'MM/DD/YY',
  'iso': 'ISO DateTime',
}

export const AMOUNT_CONVENTION_LABELS: Record<string, string> = {
  'negative_prefix': 'Negative prefix (-50.00)',
  'parentheses': 'Parentheses (($50.00))',
  'plus_minus': 'Plus/minus (- $50.00)',
}

// Helper to get colors based on confidence level
export function getConfidenceColors(confidence: number): {
  textColor: string
  barColor: string
  bgColor: string
  borderColor: string
} {
  if (confidence >= 0.8) {
    return {
      textColor: 'text-green-600 dark:text-green-400',
      barColor: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    }
  } else if (confidence >= 0.6) {
    return {
      textColor: 'text-yellow-600 dark:text-yellow-400',
      barColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    }
  }
  return {
    textColor: 'text-red-600 dark:text-red-400',
    barColor: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800'
  }
}
