'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/format'

interface ColumnHint {
  likely_type: string
  confidence: number
  detected_format?: string
  format_display?: string
  detected_settings?: {
    sign_convention: string
    currency_prefix: string
    invert_sign: boolean
  }
}

interface AnalysisResult {
  headers: string[]
  sample_rows: string[][]
  column_hints: Record<string, ColumnHint>
  suggested_config: SuggestedConfig
  row_count: number
}

interface SuggestedConfig {
  name: string
  account_source: string
  date_column: string
  amount_column: string
  description_column: string
  reference_column?: string
  category_column?: string
  date_format: string
  amount_sign_convention: string
  amount_currency_prefix?: string
  amount_invert_sign?: boolean
  _completeness: number
}

interface CustomConfig {
  name: string
  account_source: string
  date_column: string | number
  amount_column: string | number
  description_column: string | number
  merchant_column?: string | number
  reference_column?: string | number
  category_column?: string | number
  card_member_column?: string | number
  date_format: string
  amount_sign_convention: string
  amount_currency_prefix: string
  amount_invert_sign: boolean
  amount_thousands_separator: string
  row_handling: {
    skip_header_rows: number
    skip_footer_rows: number
    skip_patterns: string[]
    skip_empty_rows: boolean
  }
  merchant_split_chars: string
  merchant_max_length: number
}

interface PreviewTransaction {
  date: string
  amount: number
  description: string
  merchant: string
  account_source: string
  reference_id: string
}

interface CustomFormatMapperProps {
  file: File
  onConfigured: (config: CustomConfig) => void
  onCancel: () => void
  initialConfig?: Partial<CustomConfig> & { description?: string }
}

const DATE_FORMAT_LABELS: Record<string, string> = {
  '%m/%d/%Y': 'MM/DD/YYYY',
  '%d/%m/%Y': 'DD/MM/YYYY',
  '%Y-%m-%d': 'YYYY-MM-DD',
  '%m-%d-%Y': 'MM-DD-YYYY',
  '%m/%d/%y': 'MM/DD/YY',
  'iso': 'ISO DateTime',
}

const AMOUNT_CONVENTION_LABELS: Record<string, string> = {
  'negative_prefix': 'Negative prefix (-50.00)',
  'parentheses': 'Parentheses (($50.00))',
  'plus_minus': 'Plus/minus (- $50.00)',
}

// Helper to get colors based on confidence level
function getConfidenceColors(confidence: number): { textColor: string; barColor: string; bgColor: string; borderColor: string } {
  if (confidence >= 0.8) {
    return {
      textColor: 'text-green-600 dark:text-green-400',
      barColor: 'bg-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    }
  } else if (confidence >= 0.6) {
    return {
      textColor: 'text-yellow-600 dark:text-yellow-400',
      barColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800'
    }
  }
  return {
    textColor: 'text-red-600 dark:text-red-400',
    barColor: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800'
  }
}

// Helper to get icon based on confidence level
function ConfidenceIcon({ confidence, size = 'sm' }: { confidence: number; size?: 'sm' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'

  if (confidence >= 0.8) {
    return (
      <svg className={`${sizeClass} text-green-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  } else if (confidence >= 0.6) {
    return (
      <svg className={`${sizeClass} text-yellow-500`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg className={`${sizeClass} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  )
}

// Component to show confidence for detected columns
function ColumnConfidenceRow({
  label,
  column,
  hint,
  isSet
}: {
  label: string
  column: string
  hint?: ColumnHint
  isSet: boolean
}) {
  if (!isSet) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <span className="w-24 font-medium text-theme-muted">{label}:</span>
        <span className="text-red-600 dark:text-red-400">Not detected</span>
      </div>
    )
  }

  const confidence = hint?.confidence ?? 0
  const confidencePercent = Math.round(confidence * 100)
  const { textColor, barColor } = getConfidenceColors(confidence)

  return (
    <div className="flex items-center gap-2 text-sm">
      <ConfidenceIcon confidence={confidence} />
      <span className="w-24 font-medium text-theme-muted">{label}:</span>
      <span className="font-mono text-theme">{column}</span>
      <div className="flex items-center gap-1 ml-2">
        <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
        <span className={`text-xs ${textColor}`}>{confidencePercent}%</span>
      </div>
      {hint?.format_display && (
        <span className="text-xs text-theme-muted ml-1">({hint.format_display})</span>
      )}
    </div>
  )
}

interface AccountTag {
  id: number
  namespace: string
  value: string
  description?: string
}

export function CustomFormatMapper({ file, onConfigured, onCancel, initialConfig }: CustomFormatMapperProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Account tags for dropdown
  const [accountTags, setAccountTags] = useState<AccountTag[]>([])
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')

  // Auto-detection results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [suggested, setSuggested] = useState<SuggestedConfig | null>(null)
  const [skipRows, setSkipRows] = useState(0)

  // User inputs (only name and account are required in basic mode)
  const [configName, setConfigName] = useState(initialConfig?.name || '')
  const [configDescription, setConfigDescription] = useState(initialConfig?.description || '')
  const [accountSource, setAccountSource] = useState(initialConfig?.account_source || '')

  // Advanced overrides (populated from auto-detection, editable in advanced mode)
  const [dateColumn, setDateColumn] = useState<string>('')
  const [amountColumn, setAmountColumn] = useState<string>('')
  const [descriptionColumn, setDescriptionColumn] = useState<string>('')
  const [referenceColumn, setReferenceColumn] = useState<string>('')
  const [categoryColumn, setCategoryColumn] = useState<string>('')
  const [dateFormat, setDateFormat] = useState('%m/%d/%Y')
  const [amountConvention, setAmountConvention] = useState('negative_prefix')
  const [amountPrefix, setAmountPrefix] = useState('')
  const [invertSign, setInvertSign] = useState(false)
  const [skipFooterRows, setSkipFooterRows] = useState(0)

  // Preview
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([])
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // Auto-detect and fetch accounts on mount
  useEffect(() => {
    autoDetect()
    fetchAccountTags()
  }, [])

  async function fetchAccountTags() {
    try {
      const res = await fetch('/api/v1/tags?namespace=account')
      if (res.ok) {
        const data = await res.json()
        setAccountTags(data)
      }
    } catch (err) {
      console.error('Error fetching account tags:', err)
    }
  }

  async function createAccountTag(name: string): Promise<string | null> {
    try {
      // Normalize to tag value format
      const tagValue = name.toLowerCase().replace(/\s+/g, '-')

      const res = await fetch('/api/v1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          namespace: 'account',
          value: tagValue,
          description: name  // Use original name as display name
        })
      })

      if (res.ok) {
        const newTag = await res.json()
        setAccountTags(prev => [...prev, newTag])
        return tagValue
      }
      return null
    } catch (err) {
      console.error('Error creating account tag:', err)
      return null
    }
  }

  async function autoDetect() {
    setLoading(true)
    setError(null)

    try {
      // Call backend auto-detect endpoint
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/v1/import/custom/auto-detect', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        // Fall back to analyze endpoint
        const analyzeRes = await fetch('/api/v1/import/analyze', {
          method: 'POST',
          body: formData
        })

        if (!analyzeRes.ok) {
          throw new Error('Failed to analyze file')
        }

        const data = await analyzeRes.json()
        setAnalysis(data)

        if (data.suggested_config) {
          setSuggested(data.suggested_config)
          applyAutoDetection(data.suggested_config, 0)
        }
      } else {
        const data = await res.json()
        setAnalysis(data.analysis)
        setSuggested(data.config)
        setSkipRows(data.skip_rows || 0)
        applyAutoDetection(data.config, data.skip_rows || 0)

        // Auto-preview if detection was successful
        if (data.config && data.config._completeness >= 1.0) {
          await runPreview(data.config, data.skip_rows || 0)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file')
    } finally {
      setLoading(false)
    }
  }

  function applyAutoDetection(config: SuggestedConfig, skipRowsCount: number) {
    setDateColumn(config.date_column || '')
    setAmountColumn(config.amount_column || '')
    setDescriptionColumn(config.description_column || '')
    setReferenceColumn(config.reference_column || '')
    setCategoryColumn(config.category_column || '')
    setDateFormat(config.date_format || '%m/%d/%Y')
    setAmountConvention(config.amount_sign_convention || 'negative_prefix')
    setAmountPrefix(config.amount_currency_prefix || '')
    setInvertSign(config.amount_invert_sign || false)
    setSkipRows(skipRowsCount)
  }

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

  async function runPreview(configOverride?: SuggestedConfig, skipRowsOverride?: number) {
    setLoading(true)
    setPreviewErrors([])

    try {
      const config = configOverride ? {
        ...buildConfig(),
        date_column: configOverride.date_column,
        amount_column: configOverride.amount_column,
        description_column: configOverride.description_column,
        reference_column: configOverride.reference_column,
        category_column: configOverride.category_column,
        date_format: configOverride.date_format,
        amount_sign_convention: configOverride.amount_sign_convention,
        amount_currency_prefix: configOverride.amount_currency_prefix || '',
        amount_invert_sign: configOverride.amount_invert_sign || false,
        row_handling: {
          skip_header_rows: skipRowsOverride ?? skipRows,
          skip_footer_rows: 0,
          skip_patterns: [],
          skip_empty_rows: true,
        }
      } : buildConfig()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('config_json', JSON.stringify(config))

      const res = await fetch('/api/v1/import/custom/preview', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Preview failed')
      }

      setPreviewTransactions(data.transactions || [])
      setPreviewErrors(data.errors || [])
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    const config = buildConfig()
    onConfigured({ ...config, description: configDescription } as any)
  }

  const isReady = dateColumn && amountColumn && descriptionColumn && accountSource
  const detectionComplete = suggested && suggested._completeness >= 1.0

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
        // Calculate overall confidence as average of detected columns
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

                {/* Column Detection with Confidence */}
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
                  onClick={async () => {
                    if (newAccountName.trim()) {
                      const tagValue = await createAccountTag(newAccountName.trim())
                      if (tagValue) {
                        setAccountSource(tagValue)
                        setShowNewAccount(false)
                        setNewAccountName('')
                      }
                    }
                  }}
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

      {/* Advanced Settings (collapsed by default) */}
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
      {showPreview && previewTransactions.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-theme">
              Preview: {previewTransactions.length} transactions
            </h3>
            <button
              onClick={() => setShowPreview(false)}
              className="text-sm text-theme-muted hover:text-theme"
            >
              Hide
            </button>
          </div>

          {previewErrors.length > 0 && (
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-300">
              {previewErrors.map((err, i) => <div key={i}>{err}</div>)}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-theme-elevated">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Merchant</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewTransactions.slice(0, 5).map((txn, i) => (
                  <tr key={i} className="border-t border-theme">
                    <td className="px-3 py-2">{txn.date}</td>
                    <td className="px-3 py-2">{txn.merchant}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{txn.description}</td>
                    <td className={`px-3 py-2 text-right ${txn.amount >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {formatCurrency(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {previewTransactions.length > 5 && (
              <p className="px-3 py-2 text-sm text-theme-muted">
                + {previewTransactions.length - 5} more transactions
              </p>
            )}
          </div>
        </div>
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
              onClick={() => runPreview()}
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
