import { http, HttpResponse } from 'msw'
import {
  mockTags,
  mockBucketTags,
  mockTransactions,
  mockTransactionCount,
  mockDashboards as initialDashboards,
  mockWidgets,
  mockSummary,
  mockTrends,
  mockTopMerchants,
  mockBucketSummary,
  mockAccountSummary,
  mockVelocity,
  mockAnomalies,
} from './fixtures'

const API_BASE = '/api/v1'

// Mutable state for dashboard CRUD operations
let dashboardIdCounter = initialDashboards.length + 1
let mockDashboards = [...initialDashboards]

// Transaction splits state
let transactionSplits: Record<number, { tag: string; amount: number }[]> = {}

// Reset functions for tests
export function resetMockDashboards() {
  mockDashboards = [...initialDashboards]
  dashboardIdCounter = initialDashboards.length + 1
}

export function resetTransactionSplits() {
  transactionSplits = {}
}

export function resetAllMocks() {
  resetMockDashboards()
  resetTransactionSplits()
}

export const handlers = [
  // Tags
  http.get(`${API_BASE}/tags`, () => {
    return HttpResponse.json(mockTags)
  }),

  http.get(`${API_BASE}/tags/:namespace`, ({ params }) => {
    const { namespace } = params
    const filtered = mockTags.filter(t => t.namespace === namespace)
    return HttpResponse.json(filtered)
  }),

  // Transactions
  http.get(`${API_BASE}/transactions`, () => {
    return HttpResponse.json(mockTransactions)
  }),

  http.get(`${API_BASE}/transactions/count`, () => {
    return HttpResponse.json(mockTransactionCount)
  }),

  http.get(`${API_BASE}/transactions/:id`, ({ params }) => {
    const { id } = params
    const transaction = mockTransactions.find(t => t.id === Number(id))
    if (!transaction) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(transaction)
  }),

  // Dashboards
  http.get(`${API_BASE}/dashboards`, () => {
    return HttpResponse.json(mockDashboards)
  }),

  http.get(`${API_BASE}/dashboards/:id`, ({ params }) => {
    const { id } = params
    const dashboard = mockDashboards.find(d => d.id === Number(id))
    if (!dashboard) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(dashboard)
  }),

  http.post(`${API_BASE}/dashboards`, async ({ request }) => {
    const body = await request.json() as Partial<typeof mockDashboards[0]>
    const newDashboard = {
      id: dashboardIdCounter++,
      name: body.name || 'New Dashboard',
      description: body.description || null,
      view_mode: 'month',
      is_default: false,
      position: mockDashboards.length,
      pinned_year: null,
      pinned_month: null,
      date_range_type: body.date_range_type || 'mtd',
      date_range: {
        start_date: '2024-12-01',
        end_date: '2024-12-06',
        label: 'Month to Date',
      },
      filter_buckets: null,
      filter_accounts: null,
      filter_merchants: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockDashboards.push(newDashboard)
    return HttpResponse.json(newDashboard, { status: 201 })
  }),

  http.patch(`${API_BASE}/dashboards/:id`, async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as Partial<typeof mockDashboards[0]>
    const index = mockDashboards.findIndex(d => d.id === Number(id))
    if (index === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    mockDashboards[index] = {
      ...mockDashboards[index],
      ...body,
      updated_at: new Date().toISOString(),
    }
    return HttpResponse.json(mockDashboards[index])
  }),

  http.delete(`${API_BASE}/dashboards/:id`, ({ params }) => {
    const { id } = params
    const index = mockDashboards.findIndex(d => d.id === Number(id))
    if (index === -1) {
      return new HttpResponse(null, { status: 404 })
    }
    mockDashboards.splice(index, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE}/dashboards/:id/clone`, ({ params }) => {
    const { id } = params
    const original = mockDashboards.find(d => d.id === Number(id))
    if (!original) {
      return new HttpResponse(null, { status: 404 })
    }
    const cloned = {
      ...original,
      id: dashboardIdCounter++,
      name: `${original.name} (Copy)`,
      is_default: false,
      position: mockDashboards.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockDashboards.push(cloned)
    return HttpResponse.json(cloned, { status: 201 })
  }),

  http.post(`${API_BASE}/dashboards/:id/set-default`, ({ params }) => {
    const { id } = params
    const dashboard = mockDashboards.find(d => d.id === Number(id))
    if (!dashboard) {
      return new HttpResponse(null, { status: 404 })
    }
    // Clear existing default
    mockDashboards.forEach(d => { d.is_default = false })
    dashboard.is_default = true
    return HttpResponse.json(dashboard)
  }),

  // Dashboard Widgets (both paths used in codebase)
  http.get(`${API_BASE}/dashboard-widgets`, () => {
    return HttpResponse.json(mockWidgets)
  }),

  http.get(`${API_BASE}/dashboard/widgets`, () => {
    return HttpResponse.json(mockWidgets)
  }),

  http.get(`${API_BASE}/dashboard-widgets/:id`, ({ params }) => {
    const { id } = params
    const widget = mockWidgets.find(w => w.id === Number(id))
    if (!widget) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json(widget)
  }),

  http.patch(`${API_BASE}/dashboard/widgets/:id/visibility`, ({ params }) => {
    const { id } = params
    const widget = mockWidgets.find(w => w.id === Number(id))
    if (!widget) {
      return new HttpResponse(null, { status: 404 })
    }
    widget.is_visible = !widget.is_visible
    return HttpResponse.json(widget)
  }),

  http.put(`${API_BASE}/dashboard/layout`, async ({ request: _request }) => {
    // Just return success for layout updates
    return HttpResponse.json({ success: true })
  }),

  // Bucket tags endpoint
  http.get(`${API_BASE}/tags/buckets`, () => {
    return HttpResponse.json(mockBucketTags)
  }),

  // Reports
  http.get(`${API_BASE}/reports/summary`, () => {
    return HttpResponse.json(mockSummary)
  }),

  http.get(`${API_BASE}/reports/trends`, () => {
    return HttpResponse.json(mockTrends)
  }),

  http.get(`${API_BASE}/reports/top-merchants`, () => {
    return HttpResponse.json(mockTopMerchants)
  }),

  http.get(`${API_BASE}/reports/bucket-summary`, () => {
    return HttpResponse.json(mockBucketSummary)
  }),

  http.get(`${API_BASE}/reports/velocity`, () => {
    return HttpResponse.json(mockVelocity)
  }),

  http.get(`${API_BASE}/reports/anomalies`, () => {
    return HttpResponse.json(mockAnomalies)
  }),

  // Accounts
  http.get(`${API_BASE}/accounts/summary`, () => {
    return HttpResponse.json(mockAccountSummary)
  }),

  // Budgets (empty by default)
  http.get(`${API_BASE}/budgets`, () => {
    return HttpResponse.json([])
  }),

  http.get(`${API_BASE}/budgets/status`, () => {
    return HttpResponse.json([])
  }),

  // Transfers
  http.get(`${API_BASE}/transfers/suggestions`, () => {
    return HttpResponse.json({
      suggestions: [
        {
          id: 1,
          date: '2024-12-01',
          amount: -500,
          description: 'Transfer to Savings',
          merchant: null,
          account_source: 'Checking',
          match_reason: 'Amount matches opposite transaction',
        },
        {
          id: 2,
          date: '2024-12-01',
          amount: 500,
          description: 'Transfer from Checking',
          merchant: null,
          account_source: 'Savings',
          match_reason: 'Amount matches opposite transaction',
        },
      ],
    })
  }),

  http.get(`${API_BASE}/transfers/stats`, () => {
    return HttpResponse.json({
      transfer_count: 10,
      transfer_total: 5000,
      linked_pairs: 5,
    })
  }),

  http.post(`${API_BASE}/transfers/mark`, async () => {
    return HttpResponse.json({ marked_count: 2 })
  }),

  // Tag Rules
  http.get(`${API_BASE}/tag-rules`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Coffee shops',
        tag: 'bucket:Food',
        priority: 10,
        enabled: true,
        merchant_pattern: 'Starbucks',
        description_pattern: null,
        amount_min: null,
        amount_max: null,
        account_source: null,
        match_all: false,
        match_count: 25,
        last_matched_date: '2024-12-05',
      },
    ])
  }),

  http.post(`${API_BASE}/tag-rules`, async () => {
    return HttpResponse.json({
      id: 2,
      name: 'New Rule',
      tag: 'bucket:Shopping',
      priority: 0,
      enabled: true,
      match_all: false,
      match_count: 0,
    }, { status: 201 })
  }),

  http.patch(`${API_BASE}/tag-rules/:id`, async ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      name: 'Updated Rule',
      enabled: true,
    })
  }),

  http.delete(`${API_BASE}/tag-rules/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE}/tag-rules/:id/test`, () => {
    return HttpResponse.json({ match_count: 5 })
  }),

  http.post(`${API_BASE}/tag-rules/apply`, () => {
    return HttpResponse.json({ applied_count: 10 })
  }),

  // Merchants
  http.get(`${API_BASE}/merchants`, () => {
    return HttpResponse.json({
      merchants: [
        { name: 'AMZN MKTP US*123ABC', transaction_count: 15 },
        { name: 'STARBUCKS #12345', transaction_count: 8 },
        { name: 'UBER *TRIP', transaction_count: 5 },
      ],
    })
  }),

  http.get(`${API_BASE}/merchants/aliases`, () => {
    return HttpResponse.json([
      {
        id: 1,
        pattern: 'AMZN',
        canonical_name: 'Amazon',
        match_type: 'contains',
        priority: 10,
        match_count: 15,
      },
      {
        id: 2,
        pattern: 'STARBUCKS',
        canonical_name: 'Starbucks',
        match_type: 'contains',
        priority: 5,
        match_count: 8,
      },
    ])
  }),

  http.post(`${API_BASE}/merchants/aliases`, async () => {
    return HttpResponse.json({
      id: 3,
      pattern: 'UBER',
      canonical_name: 'Uber',
      match_type: 'contains',
      priority: 0,
      match_count: 0,
    }, { status: 201 })
  }),

  http.patch(`${API_BASE}/merchants/aliases/:id`, async () => {
    return HttpResponse.json({ id: 1, pattern: 'AMZN', canonical_name: 'Amazon Updated' })
  }),

  http.delete(`${API_BASE}/merchants/aliases/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE}/merchants/aliases/apply`, ({ request }) => {
    const url = new URL(request.url)
    const dryRun = url.searchParams.get('dry_run') === 'true'
    if (dryRun) {
      return HttpResponse.json({
        updates: [
          { transaction_id: 1, description: 'AMZN MKTP', old_merchant: null, new_merchant: 'Amazon', matched_pattern: 'AMZN' },
        ],
      })
    }
    return HttpResponse.json({ applied_count: 1 })
  }),

  // Custom CSV Formats
  http.get(`${API_BASE}/import/custom/configs`, () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Chase Credit Card',
        description: 'Chase Sapphire monthly statement',
        config_json: JSON.stringify({ account_source: 'Chase', date_column: 'Date', amount_column: 'Amount' }),
        use_count: 5,
        created_at: '2024-11-01T00:00:00Z',
        updated_at: '2024-11-15T00:00:00Z',
      },
    ])
  }),

  http.post(`${API_BASE}/import/custom/configs`, async () => {
    return HttpResponse.json({
      id: 2,
      name: 'New Format',
      use_count: 0,
      created_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.put(`${API_BASE}/import/custom/configs/:id`, async () => {
    return HttpResponse.json({ id: 1, name: 'Updated Format' })
  }),

  http.delete(`${API_BASE}/import/custom/configs/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE}/import/custom/preview`, async () => {
    return HttpResponse.json({
      transactions: [
        { date: '2024-12-01', merchant: 'Test', description: 'Test transaction', amount: -50.00 },
      ],
      errors: [],
    })
  }),

  // Transaction Splits
  http.get(`${API_BASE}/transactions/:id/splits`, ({ params }) => {
    const { id } = params
    const txnId = Number(id)
    const transaction = mockTransactions.find(t => t.id === txnId)
    if (!transaction) {
      return new HttpResponse(null, { status: 404 })
    }
    const splits = transactionSplits[txnId] || []
    const totalAmount = Math.abs(transaction.amount)
    const allocatedTotal = splits.reduce((sum, s) => sum + s.amount, 0)
    return HttpResponse.json({
      transaction_id: txnId,
      total_amount: totalAmount,
      splits,
      unallocated: totalAmount - allocatedTotal,
    })
  }),

  http.put(`${API_BASE}/transactions/:id/splits`, async ({ params, request }) => {
    const { id } = params
    const txnId = Number(id)
    const transaction = mockTransactions.find(t => t.id === txnId)
    if (!transaction) {
      return new HttpResponse(null, { status: 404 })
    }
    const body = await request.json() as { splits: { tag: string; amount: number }[] }
    transactionSplits[txnId] = body.splits
    const totalAmount = Math.abs(transaction.amount)
    const allocatedTotal = body.splits.reduce((sum, s) => sum + s.amount, 0)
    return HttpResponse.json({
      transaction_id: txnId,
      total_amount: totalAmount,
      splits: body.splits,
      unallocated: totalAmount - allocatedTotal,
    })
  }),

  // Settings
  http.get(`${API_BASE}/settings`, ({ request }) => {
    const acceptLanguage = request.headers.get('Accept-Language') || ''
    // Simple parse - just use first locale or default to en-US
    const effectiveLocale = acceptLanguage.split(',')[0]?.split(';')[0]?.trim() || 'en-US'
    return HttpResponse.json({
      language: 'browser',
      effective_locale: effectiveLocale,
      supported_locales: ['en-US', 'en-GB', 'es', 'fr', 'it', 'pt', 'de', 'nl', 'l33t'],
    })
  }),

  http.patch(`${API_BASE}/settings`, async ({ request }) => {
    const body = await request.json() as { language?: string }
    return HttpResponse.json({
      language: body.language || 'browser',
      updated_at: new Date().toISOString(),
    })
  }),
]
