'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageHelp } from '@/components/PageHelp'
import TransfersPanel from '@/components/tools/TransfersPanel'
import RulesPanel from '@/components/tools/RulesPanel'
import MerchantsPanel from '@/components/tools/MerchantsPanel'
import FormatsPanel from '@/components/tools/FormatsPanel'

type ToolsTab = 'transfers' | 'rules' | 'merchants' | 'formats'

const VALID_TABS: ToolsTab[] = ['transfers', 'rules', 'merchants', 'formats']

export default function ToolsPage() {
  const t = useTranslations('tools')
  const [activeTab, setActiveTab] = useState<ToolsTab>('transfers')

  const TAB_LABELS: Record<ToolsTab, string> = {
    transfers: t('tabs.transfers'),
    rules: t('tabs.rules'),
    merchants: t('tabs.merchants'),
    formats: t('tabs.formats')
  }

  // Read hash from URL on mount and listen for changes
  useEffect(() => {
    function updateTabFromHash() {
      const hash = window.location.hash.slice(1) // Remove #
      if (hash && VALID_TABS.includes(hash as ToolsTab)) {
        setActiveTab(hash as ToolsTab)
      }
    }

    // Set initial tab from hash
    updateTabFromHash()

    // Listen for hash changes (back/forward navigation)
    window.addEventListener('hashchange', updateTabFromHash)
    return () => window.removeEventListener('hashchange', updateTabFromHash)
  }, [])

  // Update URL hash when tab changes
  function handleTabChange(tab: ToolsTab) {
    setActiveTab(tab)
    window.history.pushState(null, '', `#${tab}`)
  }

  return (
    <div className="space-y-6" data-testid="tools-page">
      <PageHelp pageId="tools" />

      <div>
        <h1 className="text-3xl font-bold text-theme">{t('title')}</h1>
        <p className="mt-1 text-sm text-theme-muted">
          {t('subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-theme" data-testid="tools-tabs">
        <nav className="-mb-px flex space-x-8">
          {VALID_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'border-transparent text-theme-muted hover:text-theme hover:border-[var(--color-border-strong)]'
              }`}
              data-testid={`tab-${tab}`}
              data-chaos-target={`tools-tab-${tab}`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'transfers' && <TransfersPanel />}
      {activeTab === 'rules' && <RulesPanel />}
      {activeTab === 'merchants' && <MerchantsPanel />}
      {activeTab === 'formats' && <FormatsPanel />}
    </div>
  )
}
