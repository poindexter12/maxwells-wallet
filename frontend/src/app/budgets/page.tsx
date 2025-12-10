'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

interface Tag {
  id: number
  namespace: string
  value: string
  description?: string
}

interface Budget {
  id: number
  tag: string  // format: namespace:value (e.g., "bucket:groceries")
  amount: number
  period: 'monthly' | 'yearly'
  start_date?: string
  end_date?: string
  rollover_enabled: boolean
  created_at: string
}

interface BudgetStatus {
  budget_id: number
  tag: string
  budget_amount: number
  actual_amount: number
  remaining: number
  percentage_used: number
  status: 'on_track' | 'warning' | 'exceeded'
  period: string
}

interface BudgetAlert {
  budget_id: number
  tag: string
  budget_amount: number
  actual_amount: number
  percentage_used: number
  status: 'warning' | 'exceeded'
}

export default function BudgetsPage() {
  const t = useTranslations('budgets')
  const tCommon = useTranslations('common')
  const tFields = useTranslations('fields')
  const tAdmin = useTranslations('admin.tabs')

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [bucketTags, setBucketTags] = useState<Tag[]>([])
  const [occasionTags, setOccasionTags] = useState<Tag[]>([])
  const [accountTags, setAccountTags] = useState<Tag[]>([])
  const [budgetStatuses, setBudgetStatuses] = useState<BudgetStatus[]>([])
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [formData, setFormData] = useState({
    tag: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'yearly',
    rollover_enabled: false
  })

  async function fetchData() {
    try {
      const [budgetsRes, statusRes, alertsRes, bucketsRes, occasionsRes, accountsRes] = await Promise.all([
        fetch('/api/v1/budgets'),
        fetch('/api/v1/budgets/status/current'),
        fetch('/api/v1/budgets/alerts/active'),
        fetch('/api/v1/tags/buckets'),
        fetch('/api/v1/tags?namespace=occasion'),
        fetch('/api/v1/tags?namespace=account')
      ])

      const budgetsData = await budgetsRes.json()
      const statusData = await statusRes.json()
      const alertsData = await alertsRes.json()
      const bucketsData = await bucketsRes.json()
      const occasionsData = await occasionsRes.json()
      const accountsData = await accountsRes.json()

      setBudgets(budgetsData)
      setBudgetStatuses(statusData.budgets || [])
      setAlerts(alertsData.alerts || [])
      setBucketTags(bucketsData)
      setOccasionTags(occasionsData)
      setAccountTags(accountsData)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching budget data:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      tag: formData.tag,
      amount: parseFloat(formData.amount),
      period: formData.period,
      rollover_enabled: formData.rollover_enabled
    }

    try {
      if (editingBudget) {
        await fetch(`/api/v1/budgets/${editingBudget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        await fetch('/api/v1/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      setShowForm(false)
      setEditingBudget(null)
      setFormData({ tag: '', amount: '', period: 'monthly', rollover_enabled: false })
      fetchData()
    } catch (error) {
      console.error('Error saving budget:', error)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t('confirmDelete'))) return

    try {
      await fetch(`/api/v1/budgets/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Error deleting budget:', error)
    }
  }

  function handleEdit(budget: Budget) {
    setEditingBudget(budget)
    setFormData({
      tag: budget.tag,
      amount: budget.amount.toString(),
      period: budget.period,
      rollover_enabled: budget.rollover_enabled
    })
    setShowForm(true)
  }

  function formatTagDisplay(tag: string): string {
    // Convert "bucket:groceries" to "Groceries (Bucket)"
    const parts = tag.split(':')
    if (parts.length === 2) {
      const [namespace, value] = parts
      const formattedValue = value.charAt(0).toUpperCase() + value.slice(1)
      const namespaceLabel = namespace.charAt(0).toUpperCase() + namespace.slice(1)
      return `${formattedValue} (${namespaceLabel})`
    }
    return tag
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'exceeded': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function getProgressColor(status: string) {
    switch (status) {
      case 'on_track': return 'bg-green-600'
      case 'warning': return 'bg-yellow-600'
      case 'exceeded': return 'bg-red-600'
      default: return 'bg-gray-600'
    }
  }

  if (loading) {
    return <div className="text-center py-12">{tCommon('loading')}</div>
  }

  return (
    <div className="space-y-6">
      <PageHelp pageId="budgets" />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-theme">{t('title')}</h1>
          <p className="mt-2 text-sm text-theme-muted">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingBudget(null)
            setFormData({ tag: '', amount: '', period: 'monthly', rollover_enabled: false })
            setShowForm(true)
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          data-chaos-target="budget-new"
        >
          {t('newBudget')}
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 text-red-600">{t('alerts')}</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.budget_id}
                className={`p-4 rounded-md ${
                  alert.status === 'exceeded' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">{formatTagDisplay(alert.tag)}</p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(alert.actual_amount)} of {formatCurrency(alert.budget_amount)} ({alert.percentage_used.toFixed(1)}%)
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    alert.status === 'exceeded' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {alert.status === 'exceeded' ? t('status.exceeded') : t('status.warning')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgetStatuses.map((status) => (
          <div key={status.budget_id} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{formatTagDisplay(status.tag)}</h3>
                <p className="text-sm text-gray-600">{status.period}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status.status)}`}>
                {status.status === 'on_track' ? t('status.onTrack') :
                 status.status === 'warning' ? t('status.warning') : t('status.exceeded')}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('spent')}</span>
                <span className="font-semibold">{formatCurrency(status.actual_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('budget')}</span>
                <span className="font-semibold">{formatCurrency(status.budget_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('remaining')}</span>
                <span className={`font-semibold ${status.remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(status.remaining))}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="pt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{t('used', { percent: status.percentage_used.toFixed(1) })}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getProgressColor(status.status)}`}
                    style={{ width: `${Math.min(status.percentage_used, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budgets List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{t('allBudgets')}</h2>
        </div>
        <div className="divide-y">
          {budgets.length === 0 ? (
            <p className="text-gray-500 text-center py-8">{t('noBudgets')}</p>
          ) : (
            budgets.map((budget) => (
              <div key={budget.id} className="px-6 py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{formatTagDisplay(budget.tag)}</p>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(budget.amount)} / {budget.period === 'monthly' ? t('monthly') : t('yearly')}
                    {budget.rollover_enabled && ' • Rollover enabled'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(budget)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    data-chaos-target={`budget-edit-${budget.id}`}
                  >
                    {tCommon('edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                    data-chaos-exclude
                  >
                    {tCommon('delete')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingBudget ? t('editBudget') : t('createBudget')}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tFields('category')}
                </label>
                <select
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                  data-chaos-target="budget-form-category"
                >
                  <option value="">{t('selectCategory')}</option>
                  {bucketTags.length > 0 && (
                    <optgroup label={tAdmin('buckets')}>
                      {bucketTags.map((tag) => (
                        <option key={tag.id} value={`bucket:${tag.value}`}>
                          {tag.description || tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {occasionTags.length > 0 && (
                    <optgroup label={tAdmin('occasions')}>
                      {occasionTags.map((tag) => (
                        <option key={tag.id} value={`occasion:${tag.value}`}>
                          {tag.description || tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {accountTags.length > 0 && (
                    <optgroup label={tAdmin('accounts')}>
                      {accountTags.map((tag) => (
                        <option key={tag.id} value={`account:${tag.value}`}>
                          {tag.description || tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tFields('amount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                  data-chaos-target="budget-form-amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tFields('period')}
                </label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as 'monthly' | 'yearly' })}
                  className="w-full px-3 py-2 border rounded-md"
                  data-chaos-target="budget-form-period"
                >
                  <option value="monthly">{t('monthly')}</option>
                  <option value="yearly">{t('yearly')}</option>
                </select>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.rollover_enabled}
                  onChange={(e) => setFormData({ ...formData, rollover_enabled: e.target.checked })}
                  className="mr-2"
                  id="rollover"
                  data-chaos-target="budget-form-rollover"
                />
                <label htmlFor="rollover" className="text-sm text-gray-700">
                  {t('rollover')}
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingBudget(null)
                  }}
                  className="flex-1 px-4 py-2 border rounded-md hover:bg-gray-50"
                  data-chaos-target="budget-form-cancel"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  data-chaos-target="budget-form-submit"
                >
                  {editingBudget ? tCommon('update') : tCommon('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
