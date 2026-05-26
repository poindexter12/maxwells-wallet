'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { TEST_IDS } from '@/test-ids'
import {
  updateAssistantConfig,
  type AssistantConfig,
} from '@/lib/assistant'

interface AssistantSettingsProps {
  config: AssistantConfig
  onSaved: (config: AssistantConfig) => void
}

/**
 * Configure the BYOK provider/model/key. The API key is write-only: the server
 * never returns it, so this form only ever sends a new one (or clears it).
 */
export function AssistantSettings({ config, onSaved }: AssistantSettingsProps) {
  const t = useTranslations('assistant.settings')
  const [provider, setProvider] = useState(config.provider ?? config.available_providers[0] ?? 'anthropic')
  const [model, setModel] = useState(config.model ?? '')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const updated = await updateAssistantConfig({
        provider,
        model: model || undefined,
        api_key: apiKey || undefined,
      })
      setApiKey('')
      setSaved(true)
      onSaved(updated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h3>
        <span
          className={
            config.configured
              ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }
        >
          {config.configured ? t('configured') : t('notConfigured')}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">{t('provider')}</span>
          <select
            data-testid={TEST_IDS.ASSISTANT_PROVIDER_SELECT}
            data-chaos-exclude
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value)
              // Suggest the provider's default model if the box is empty.
              if (!model) setModel(config.default_models[e.target.value] ?? '')
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            {config.available_providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">{t('model')}</span>
          <input
            data-testid={TEST_IDS.ASSISTANT_MODEL_INPUT}
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={config.default_models[provider] ?? ''}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">{t('apiKey')}</span>
        <input
          data-testid={TEST_IDS.ASSISTANT_KEY_INPUT}
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.key_stored ? t('apiKeyStored') : t('apiKeyPlaceholder')}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('keyNeverShown')}</span>
      </label>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          data-testid={TEST_IDS.ASSISTANT_SETTINGS_SAVE}
          data-chaos-exclude
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {t('save')}
        </button>
        {saved && <span className="text-sm text-green-700 dark:text-green-400">{t('saved')}</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </div>
  )
}
