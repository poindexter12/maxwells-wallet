'use client'

import { useTranslations } from 'next-intl'
import { useFormat } from '@/hooks/useFormat'
import { Widget, TopMerchantsData } from './types'
import { TEST_IDS } from '@/test-ids'

interface TopMerchantsListProps {
  widget?: Widget
  data: TopMerchantsData | null
}

export function TopMerchantsList({ widget, data }: TopMerchantsListProps) {
  const t = useTranslations('dashboard.widgets')
  const { formatCurrency } = useFormat()

  return (
    <div className="card p-6" data-testid={TEST_IDS.WIDGET_TOP_MERCHANTS}>
      <h2 className="text-lg font-semibold text-theme mb-4" data-testid={TEST_IDS.WIDGET_TOP_MERCHANTS_TITLE}>{t('topMerchants')}</h2>
      {data && data.merchants.length > 0 ? (
        <div className="space-y-3" data-testid={TEST_IDS.WIDGET_TOP_MERCHANTS_LIST}>
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
        <p className="text-theme-muted text-center py-12" data-testid={TEST_IDS.WIDGET_TOP_MERCHANTS_EMPTY}>{t('noMerchantData')}</p>
      )}
    </div>
  )
}
