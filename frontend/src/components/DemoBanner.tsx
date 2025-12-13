'use client'

import { useDemoMode } from '@/contexts/DemoModeContext'
import { TEST_IDS } from '@/test-ids'
import { useTranslations } from 'next-intl'

export function DemoBanner() {
  const { isDemoMode, message } = useDemoMode()
  const t = useTranslations('demo')

  if (!isDemoMode) {
    return null
  }

  return (
    <div
      data-testid={TEST_IDS.DEMO_BANNER}
      className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium sticky top-0 z-50"
    >
      {message || t('banner')}
    </div>
  )
}
