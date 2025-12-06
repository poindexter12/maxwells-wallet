import { http, HttpResponse } from 'msw'
import {
  mockTags,
  mockBucketTags,
  mockAccountTags,
  mockTransactions,
  mockTransactionCount,
  mockDashboards,
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

  // Dashboard Widgets
  http.get(`${API_BASE}/dashboard-widgets`, () => {
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
]
