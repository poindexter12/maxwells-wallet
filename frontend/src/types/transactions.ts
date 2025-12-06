// Shared types for transactions feature

export interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

export interface TransactionTag {
  namespace: string
  value: string
  full: string
}

export interface Transaction {
  id: number
  date: string
  amount: number
  description: string
  merchant: string | null
  account_source: string
  account_tag_id: number | null
  category: string | null
  reconciliation_status: string
  notes?: string | null
  tags?: TransactionTag[]
  bucket?: string
  account?: string
  is_transfer?: boolean
  linked_transaction_id?: number | null
}

export interface TransactionFilters {
  search: string
  bucket: string
  occasion: string
  accounts: string[]
  accountsExclude: string[]
  status: string
  amountMin: string
  amountMax: string
  startDate: string
  endDate: string
  transfers: 'all' | 'hide' | 'only'
}

export const INITIAL_FILTERS: TransactionFilters = {
  search: '',
  bucket: '',
  occasion: '',
  accounts: [],
  accountsExclude: [],
  status: '',
  amountMin: '',
  amountMax: '',
  startDate: '',
  endDate: '',
  transfers: 'hide'
}

// Bucket color mapping for left border
export const BUCKET_COLORS: Record<string, string> = {
  'groceries': 'border-l-green-500',
  'dining': 'border-l-orange-500',
  'entertainment': 'border-l-purple-500',
  'transportation': 'border-l-blue-500',
  'utilities': 'border-l-yellow-500',
  'housing': 'border-l-indigo-500',
  'healthcare': 'border-l-red-500',
  'shopping': 'border-l-pink-500',
  'subscriptions': 'border-l-cyan-500',
  'education': 'border-l-teal-500',
  'income': 'border-l-emerald-500',
  'other': 'border-l-gray-400',
  'none': 'border-l-gray-300',
}

export function getBucketBorderColor(bucket: string | null | undefined): string {
  if (!bucket) return 'border-l-gray-200'
  return BUCKET_COLORS[bucket.toLowerCase()] || 'border-l-gray-400'
}
