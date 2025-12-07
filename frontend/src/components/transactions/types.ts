/**
 * Transaction list types for virtual scrolling components.
 */

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

/**
 * Props for TransactionRow component.
 * Contains callbacks for all interactive actions.
 */
export interface TransactionRowProps {
  txn: Transaction
  isSelected: boolean
  isExpanded: boolean
  isAddingTag: boolean
  isEditingNote: boolean
  noteValue: string
  bucketTags: Tag[]
  accountTags: Tag[]
  allTags: Tag[]
  availableTags: Tag[]

  // Callbacks
  onToggleSelect: (id: number) => void
  onToggleExpand: (id: number) => void
  onBucketChange: (id: number, bucket: string) => void
  onAccountChange: (id: number, account: string) => void
  onAddTag: (id: number, tagValue: string) => void
  onRemoveTag: (id: number, tagFull: string) => void
  onStartAddTag: (id: number) => void
  onCancelAddTag: () => void
  onToggleTransfer: (id: number, currentValue: boolean) => void
  onUnlinkTransfer: (id: number) => void
  onStartEditNote: (txn: Transaction) => void
  onSaveNote: (id: number) => void
  onCancelEditNote: () => void
  onNoteChange: (value: string) => void
  onDelete: (id: number) => void
  onRefresh: () => void  // Called after splits or other changes that need a refresh
}

/**
 * Bucket colors for left border indication.
 */
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

/**
 * Get the border color class for a bucket.
 */
export function getBucketBorderColor(bucket: string | undefined): string {
  return BUCKET_COLORS[bucket || 'none'] || BUCKET_COLORS['none']
}
