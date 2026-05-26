'use client'

import { useTranslations } from 'next-intl'
import { TEST_IDS } from '@/test-ids'
import type { AssistantConfig } from '@/lib/assistant'

interface AssistantSettingsProps {
  config: AssistantConfig
}

/**
 * Read-only status panel. The assistant is configured entirely via the server
 * environment (ANTHROPIC_API_KEY / OPENAI_API_KEY, optional ASSISTANT_PROVIDER /
 * ASSISTANT_MODEL) — there is no key entry here and nothing is stored.
 */
export function AssistantSettings({ config }: AssistantSettingsProps) {
  const t = useTranslations('assistant.settings')

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h3>
        <span
          data-testid={TEST_IDS.ASSISTANT_SETTINGS_STATUS}
          className={
            config.configured
              ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }
        >
          {config.configured ? t('configured') : t('notConfigured')}
        </span>
      </div>

      {config.configured ? (
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500 dark:text-gray-400">{t('provider')}</dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">{config.provider}</dd>
          <dt className="text-gray-500 dark:text-gray-400">{t('model')}</dt>
          <dd className="font-medium text-gray-900 dark:text-gray-100">{config.model}</dd>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{t('notConfiguredHelp')}</p>
      )}

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">{t('envManaged')}</p>
    </div>
  )
}
