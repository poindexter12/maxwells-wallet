'use client'

import { useEffect, useState } from 'react'
import { PageHelp } from '@/components/PageHelp'
import TransfersPanel from '@/components/tools/TransfersPanel'
import RulesPanel from '@/components/tools/RulesPanel'
import MerchantsPanel from '@/components/tools/MerchantsPanel'
import FormatsPanel from '@/components/tools/FormatsPanel'

type ToolsTab = 'transfers' | 'rules' | 'merchants' | 'formats'

const VALID_TABS: ToolsTab[] = ['transfers', 'rules', 'merchants', 'formats']

const TAB_LABELS: Record<ToolsTab, string> = {
  transfers: 'Transfers',
  rules: 'Rules',
  merchants: 'Merchants',
  formats: 'CSV Formats'
}

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolsTab>('transfers')

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
      <PageHelp
        pageId="tools"
        title="Automation Tools"
        description="Utilities to automate categorization and clean up your transaction data."
        steps={[
          "Transfers: Identify and mark internal transfers between your accounts",
          "Rules: Create auto-categorization rules based on merchant, description, or amount",
          "Merchants: Normalize messy bank merchant names into clean, consistent names",
          "CSV Formats: Create reusable import configurations for different bank CSV formats"
        ]}
        tips={[
          "Transfers are excluded from spending calculations",
          "Rules run automatically when you import new transactions",
          "Preview merchant alias changes before applying them",
          "Custom CSV formats can be selected during import"
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold text-theme">Tools</h1>
        <p className="mt-1 text-sm text-theme-muted">
          Automation and cleanup utilities
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
