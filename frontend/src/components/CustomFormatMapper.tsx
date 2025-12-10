'use client'

import { useState } from 'react'
import {
  CustomConfig,
  DATE_FORMAT_LABELS,
  AMOUNT_CONVENTION_LABELS,
  getConfidenceColors
} from '@/types/customFormat'
import { ConfidenceIcon, ColumnConfidenceRow } from './format-mapper/ConfidenceDisplay'
import { PreviewTable } from './format-mapper/PreviewTable'
import { useFormatDetection } from '@/hooks/useFormatDetection'

export type { CustomConfig } from '@/types/customFormat'

interface CustomFormatMapperProps {
  file: File
  onConfigured: (config: CustomConfig) => void
  onCancel: () => void
  initialConfig?: Partial<CustomConfig> & { description?: string }
}

export function CustomFormatMapper({ file, onConfigured, onCancel, initialConfig }: CustomFormatMapperProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')

  // User inputs
  const [configName, setConfigName] = useState(initialConfig?.name || '')
  const [configDescription, setConfigDescription] = useState(initialConfig?.description || '')
  const [accountSource, setAccountSource] = useState(initialConfig?.account_source || '')

  // Use the format detection hook
  const {
    loading,
    error,
    analysis,
    suggested,
    skipRows,
    setSkipRows,
    previewTransactions,
    previewErrors,
    showPreview,
    setShowPreview,
    accountTags,
    runPreview,
    createAccountTag,
    detectionComplete,
    dateColumn,
    setDateColumn,
    amountColumn,
    setAmountColumn,
    descriptionColumn,
    setDescriptionColumn,
    referenceColumn,
    setReferenceColumn,
    categoryColumn,
    setCategoryColumn,
    dateFormat,
    setDateFormat,
    amountConvention,
    setAmountConvention,
    amountPrefix,
    setAmountPrefix: _setAmountPrefix,
    invertSign,
    setInvertSign,
    skipFooterRows,
    setSkipFooterRows: _setSkipFooterRows,
  } = useFormatDetection({ file, initialConfig })

  function buildConfig(): CustomConfig {
    return {
      name: configName || `${file.name} Format`,
      account_source: accountSource,
      date_column: dateColumn,
      amount_column: amountColumn,
      description_column: descriptionColumn,
      reference_column: referenceColumn || undefined,
      category_column: categoryColumn || undefined,
      date_format: dateFormat,
      amount_sign_convention: amountConvention,
      amount_currency_prefix: amountPrefix,
      amount_invert_sign: invertSign,
      amount_thousands_separator: ',',
      row_handling: {
        skip_header_rows: skipRows,
        skip_footer_rows: skipFooterRows,
        skip_patterns: [],
        skip_empty_rows: true,
      },
      merchant_split_chars: '',
      merchant_max_length: 50,
    }
  }

  function handleConfirm() {
    const config = buildConfig()
    onConfigured({ ...config, description: configDescription })
  }

  async function handleNewAccount() {
    if (newAccountName.trim()) {
      const tagValue = await createAccountTag(newAccountName.trim())
      if (tagValue) {
        setAccountSource(tagValue)
        setShowNewAccount(false)
        setNewAccountName('')
      }
    }
  }

  const isReady = dateColumn && amountColumn && descriptionColumn && accountSource

  if (loading && !analysis) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-theme-muted">Analyzing {file.name}...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Detection Status with Confidence */}
      {suggested && analysis && (() => {
        const columnConfidences: number[] = []
        if (dateColumn && analysis.column_hints?.[dateColumn]) {
          columnConfidences.push(analysis.column_hints[dateColumn].confidence)
        }
        if (amountColumn && analysis.column_hints?.[amountColumn]) {
          columnConfidences.push(analysis.column_hints[amountColumn].confidence)
        }
        if (descriptionColumn && analysis.column_hints?.[descriptionColumn]) {
          columnConfidences.push(analysis.column_hints[descriptionColumn].confidence)
        }
        const overallConfidence = columnConfidences.length > 0
          ? columnConfidences.reduce((a, b) => a + b, 0) / columnConfidences.length
          : 0
        const overallPercent = Math.round(overallConfidence * 100)
        const { bgColor, borderColor, textColor, barColor } = getConfidenceColors(overallConfidence)

        return (
          <div className={`p-4 rounded-lg border ${bgColor} ${borderColor}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <ConfidenceIcon confidence={overallConfidence} size="lg" />
                  <h3 className={`font-semibold ${textColor}`}>
                    {detectionComplete ? 'Format Auto-Detected' : 'Partial Detection'}
                  </h3>
                  <div className="flex items-center gap-2 ml-2">
                    <div className="w-20 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all`}
                        style={{ width: `${overallPercent}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${textColor}`}>{overallPercent}%</span>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <ColumnConfidenceRow
                    label="Date"
                    column={dateColumn}
                    hint={analysis.column_hints?.[dateColumn]}
                    isSet={!!dateColumn}
                  />
                  <ColumnConfidenceRow
                    label="Amount"
                    column={amountColumn}
                    hint={analysis.column_hints?.[amountColumn]}
                    isSet={!!amountColumn}
                  />
                  <ColumnConfidenceRow
                    label="Description"
                    column={descriptionColumn}
                    hint={analysis.column_hints?.[descriptionColumn]}
                    isSet={!!descriptionColumn}
                  />
                </div>

                <p className="text-sm text-theme-muted mt-3">
                  Date format: {DATE_FORMAT_LABELS[dateFormat] || dateFormat}
                  {invertSign && ' • Sign inverted'}
                  {amountPrefix && ` • Currency: ${amountPrefix}`}
                </p>
              </div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              >
                {showAdvanced ? 'Hide Details' : 'Edit Details'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Basic Configuration */}
      <div className="card p-4 space-y-4">
        <h3 className="font-semibold text-theme">Configuration</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-theme-muted mb-1">
              Format Name
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder={`${file.name} Format`}
              className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
            />
          </div>
          <div>
            <label className="block text-sm text-theme-muted mb-1">
              Account <span className="text-red-500">*</span>
            </label>
            {showNewAccount ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="New account name"
                  className="flex-1 px-3 py-2 border rounded-md bg-theme text-theme"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleNewAccount}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewAccount(false)
                    setNewAccountName('')
                  }}
                  className="px-3 py-2 border border-theme rounded-md hover:bg-theme-elevated"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={accountSource}
                  onChange={(e) => setAccountSource(e.target.value)}
                  className={`flex-1 px-3 py-2 border rounded-md bg-theme text-theme ${!accountSource ? 'border-yellow-400' : ''}`}
                >
                  <option value="">-- Select Account --</option>
                  {accountTags.map((tag) => (
                    <option key={tag.id} value={tag.value}>
                      {tag.description || tag.value}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewAccount(true)}
                  className="px-3 py-2 border border-theme rounded-md hover:bg-theme-elevated text-sm whitespace-nowrap"
                  title="Create new account"
                >
                  + New
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm text-theme-muted mb-1">
            Description <span className="text-theme-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={configDescription}
            onChange={(e) => setConfigDescription(e.target.value)}
            placeholder="e.g., Monthly statement export from Chase"
            className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
          />
        </div>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && analysis && (
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-theme">Advanced Settings</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-theme-muted mb-1">Date Column *</label>
              <select
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                <option value="">-- Select --</option>
                {analysis.headers.filter(h => h).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-theme-muted mb-1">Amount Column *</label>
              <select
                value={amountColumn}
                onChange={(e) => setAmountColumn(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                <option value="">-- Select --</option>
                {analysis.headers.filter(h => h).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-theme-muted mb-1">Description Column *</label>
              <select
                value={descriptionColumn}
                onChange={(e) => setDescriptionColumn(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                <option value="">-- Select --</option>
                {analysis.headers.filter(h => h).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-theme-muted mb-1">Reference Column</label>
              <select
                value={referenceColumn}
                onChange={(e) => setReferenceColumn(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                <option value="">-- None --</option>
                {analysis.headers.filter(h => h).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-theme-muted mb-1">Category Column</label>
              <select
                value={categoryColumn}
                onChange={(e) => setCategoryColumn(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                <option value="">-- None --</option>
                {analysis.headers.filter(h => h).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-theme-muted mb-1">Skip Header Rows</label>
              <input
                type="number"
                min="0"
                value={skipRows}
                onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-theme-muted mb-1">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                {Object.entries(DATE_FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-theme-muted mb-1">Amount Format</label>
              <select
                value={amountConvention}
                onChange={(e) => setAmountConvention(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-theme text-theme"
              >
                {Object.entries(AMOUNT_CONVENTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={invertSign}
                  onChange={(e) => setInvertSign(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Invert sign</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <PreviewTable
          transactions={previewTransactions}
          errors={previewErrors}
          onHide={() => setShowPreview(false)}
        />
      )}

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t border-theme">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-theme-muted hover:text-theme"
        >
          Cancel
        </button>

        <div className="flex gap-3">
          {!showPreview && (
            <button
              onClick={() => runPreview(buildConfig())}
              disabled={!isReady || loading}
              className="px-4 py-2 border border-theme rounded-md hover:bg-theme-elevated disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!isReady || previewTransactions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Save Format
          </button>
        </div>
      </div>
    </div>
  )
}
