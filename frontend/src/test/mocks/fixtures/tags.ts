// Mock tag data for testing

export const mockTags = [
  // Bucket tags
  { id: 1, namespace: 'bucket', value: 'groceries', description: 'Food and groceries', sort_order: 0, color: '#22c55e' },
  { id: 2, namespace: 'bucket', value: 'dining', description: 'Restaurants and takeout', sort_order: 1, color: '#f97316' },
  { id: 3, namespace: 'bucket', value: 'utilities', description: 'Bills and utilities', sort_order: 2, color: '#3b82f6' },
  { id: 4, namespace: 'bucket', value: 'entertainment', description: 'Movies, games, etc', sort_order: 3, color: '#a855f7' },
  { id: 5, namespace: 'bucket', value: 'transportation', description: 'Gas, transit, etc', sort_order: 4, color: '#eab308' },

  // Account tags
  { id: 10, namespace: 'account', value: 'chase-checking', description: 'Chase Checking', sort_order: 0, color: '#1e40af', due_day: null, credit_limit: null },
  { id: 11, namespace: 'account', value: 'amex-gold', description: 'Amex Gold Card', sort_order: 1, color: '#b45309', due_day: 15, credit_limit: 10000 },
  { id: 12, namespace: 'account', value: 'bofa-visa', description: 'BofA Visa', sort_order: 2, color: '#dc2626', due_day: 20, credit_limit: 5000 },

  // Occasion tags
  { id: 20, namespace: 'occasion', value: 'vacation', description: 'Vacation spending', sort_order: 0, color: '#06b6d4' },
  { id: 21, namespace: 'occasion', value: 'birthday', description: 'Birthday gifts/parties', sort_order: 1, color: '#ec4899' },
]

export const mockBucketTags = mockTags.filter(t => t.namespace === 'bucket')
export const mockAccountTags = mockTags.filter(t => t.namespace === 'account')
export const mockOccasionTags = mockTags.filter(t => t.namespace === 'occasion')
