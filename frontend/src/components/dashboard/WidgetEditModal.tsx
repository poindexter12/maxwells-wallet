'use client'

import { useTranslations } from 'next-intl'
import { Widget, Bucket, FilterOption, WIDGET_INFO } from '@/types/dashboard'

interface WidgetEditModalProps {
  widget: Widget
  editBuckets: string[]
  setEditBuckets: (buckets: string[]) => void
  editAccounts: string[]
  setEditAccounts: (accounts: string[]) => void
  editMerchants: string[]
  setEditMerchants: (merchants: string[]) => void
  availableBuckets: Bucket[]
  availableAccounts: FilterOption[]
  availableMerchants: FilterOption[]
  saving: boolean
  onClose: () => void
  onSave: () => void
}

export function WidgetEditModal({
  widget,
  editBuckets,
  setEditBuckets,
  editAccounts,
  setEditAccounts,
  editMerchants,
  setEditMerchants,
  availableBuckets,
  availableAccounts,
  availableMerchants,
  saving,
  onClose,
  onSave
}: WidgetEditModalProps) {
  const t = useTranslations('dashboard.widgets')
  const info = WIDGET_INFO[widget.widget_type]
  const widgetName = info ? t(info.nameKey as 'summary') : widget.widget_type

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-theme-elevated border border-theme rounded-lg shadow-xl z-50 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-theme mb-4">
          Configure {info?.icon} {widgetName}
        </h3>

        <div className="space-y-4">
          {/* Filter Sections - only show for filterable widgets */}
          {info?.supportsFilter && (
            <div className="space-y-4">
              {/* Bucket Filter */}
              {availableBuckets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">
                    Filter by Buckets
                  </label>
                  <p className="text-xs text-theme-muted mb-2">
                    Show only transactions in selected categories.
                  </p>
                  <div className="max-h-32 overflow-y-auto border border-theme rounded-md p-2">
                    {availableBuckets.map((bucket) => (
                      <label
                        key={bucket.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editBuckets.includes(bucket.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditBuckets([...editBuckets, bucket.value])
                            } else {
                              setEditBuckets(editBuckets.filter(b => b !== bucket.value))
                            }
                          }}
                          className="rounded border-theme text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-sm text-theme capitalize">{bucket.value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Account Filter */}
              {availableAccounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">
                    Filter by Accounts
                  </label>
                  <p className="text-xs text-theme-muted mb-2">
                    Show only transactions from selected accounts.
                  </p>
                  <div className="max-h-32 overflow-y-auto border border-theme rounded-md p-2">
                    {availableAccounts.map((account) => (
                      <label
                        key={account.value}
                        className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editAccounts.includes(account.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAccounts([...editAccounts, account.value])
                              } else {
                                setEditAccounts(editAccounts.filter(a => a !== account.value))
                              }
                            }}
                            className="rounded border-theme text-green-500 focus:ring-green-500"
                          />
                          <span className="text-sm text-theme">{account.value}</span>
                        </div>
                        <span className="text-xs text-theme-muted">{account.count}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Merchant Filter */}
              {availableMerchants.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-theme mb-1">
                    Filter by Merchants
                  </label>
                  <p className="text-xs text-theme-muted mb-2">
                    Show only transactions from selected merchants.
                  </p>
                  <div className="max-h-32 overflow-y-auto border border-theme rounded-md p-2">
                    {availableMerchants.slice(0, 50).map((merchant) => (
                      <label
                        key={merchant.value}
                        className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editMerchants.includes(merchant.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditMerchants([...editMerchants, merchant.value])
                              } else {
                                setEditMerchants(editMerchants.filter(m => m !== merchant.value))
                              }
                            }}
                            className="rounded border-theme text-purple-500 focus:ring-purple-500"
                          />
                          <span className="text-sm text-theme">{merchant.value}</span>
                        </div>
                        <span className="text-xs text-theme-muted">{merchant.count}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}
