import { http, HttpResponse } from 'msw'
import {
  mockTags,
  mockBucketTags,
  mockAccountTags,
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

  http.put(`${API_BASE}/dashboard/layout`, async ({ request }) => {
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
]
