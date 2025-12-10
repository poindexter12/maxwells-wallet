'use client'

import { useTranslations } from 'next-intl'
import { formatCurrency } from '@/lib/format'
import { Widget, TopMerchantsData } from './types'

interface TopMerchantsListProps {
  widget?: Widget
  data: TopMerchantsData | null
}

export function TopMerchantsList({ widget, data }: TopMerchantsListProps) {
  const t = useTranslations('dashboard.widgets')

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-theme mb-4">{widget?.title || t('topMerchants')}</h2>
      {data && data.merchants.length > 0 ? (
        <div className="space-y-3">
          {data.merchants.slice(0, 10).map((merchant, index) => (
            <div key={index} className="flex justify-between items-center">
              <span className="text-sm text-theme">{merchant.merchant}</span>
              <span className="text-sm font-semibold text-theme">
                {formatCurrency(merchant.amount)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-theme-muted text-center py-12">{t('noMerchantData')}</p>
      )}
    </div>
  )
}
