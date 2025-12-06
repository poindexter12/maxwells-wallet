// Mock reports data for testing

export const mockSummary = {
  total_income: 3500.00,
  total_expenses: 292.49,
  net: 3207.51,
  transaction_count: 5,
}

export const mockTrends = [
  { month: '2024-10', income: 3500, expenses: 1200 },
  { month: '2024-11', income: 3500, expenses: 1450 },
  { month: '2024-12', income: 3500, expenses: 292.49 },
]

export const mockTopMerchants = [
  { merchant: 'Restaurant XYZ', total: 125.00, count: 1 },
  { merchant: 'Electric Co', total: 89.99, count: 1 },
  { merchant: 'Whole Foods', total: 45.50, count: 1 },
  { merchant: 'Shell', total: 32.00, count: 1 },
]

export const mockBucketSummary = [
  { bucket: 'groceries', total: 45.50, count: 1 },
  { bucket: 'dining', total: 125.00, count: 1 },
  { bucket: 'utilities', total: 89.99, count: 1 },
  { bucket: 'transportation', total: 32.00, count: 1 },
]

export const mockAccountSummary = [
  {
    account: 'chase-checking',
    tag_id: 10,
    total_income: 3500.00,
    total_expenses: 135.49,
    net: 3364.51,
    transaction_count: 3,
    due_day: null,
    credit_limit: null,
  },
  {
    account: 'amex-gold',
    tag_id: 11,
    total_income: 0,
    total_expenses: 125.00,
    net: -125.00,
    transaction_count: 1,
    due_day: 15,
    credit_limit: 10000,
  },
  {
    account: 'bofa-visa',
    tag_id: 12,
    total_income: 0,
    total_expenses: 32.00,
    net: -32.00,
    transaction_count: 1,
    due_day: 20,
    credit_limit: 5000,
  },
]

export const mockVelocity = {
  daily_average: 58.50,
  projected_monthly: 1755.00,
  days_in_month: 30,
  days_elapsed: 5,
}

export const mockAnomalies = [
  {
    transaction_id: 2,
    amount: -125.00,
    merchant: 'Restaurant XYZ',
    date: '2024-12-02',
    reason: 'Unusually high for dining category',
  },
]
