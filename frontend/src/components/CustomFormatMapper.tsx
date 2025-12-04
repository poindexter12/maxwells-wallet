'use client'

import { useState, useEffect, useCallback } from 'react'
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
  row_count: number
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

interface SavedConfig {
  id: number
  name: string
  description?: string
  config_json: string
  use_count: number
}

interface CustomFormatMapperProps {
  file: File
  onConfigured: (config: CustomConfig) => void
  onCancel: () => void
}

const DATE_FORMATS = [
  { value: '%m/%d/%Y', label: 'MM/DD/YYYY (01/15/2025)' },
  { value: '%d/%m/%Y', label: 'DD/MM/YYYY (15/01/2025)' },
  { value: '%Y-%m-%d', label: 'YYYY-MM-DD (2025-01-15)' },
  { value: '%m-%d-%Y', label: 'MM-DD-YYYY (01-15-2025)' },
  { value: '%d-%m-%Y', label: 'DD-MM-YYYY (15-01-2025)' },
  { value: '%m/%d/%y', label: 'MM/DD/YY (01/15/25)' },
  { value: '%d/%m/%y', label: 'DD/MM/YY (15/01/25)' },
  { value: 'iso', label: 'ISO Format (2025-01-15T00:00:00)' },
]

const AMOUNT_CONVENTIONS = [
  { value: 'negative_prefix', label: 'Negative prefix (-50.00)' },
  { value: 'parentheses', label: 'Parentheses for negative (($50.00))' },
  { value: 'plus_minus', label: 'Plus/minus prefix (+ $50 / - $50)' },
]

export function CustomFormatMapper({ file, onConfigured, onCancel }: CustomFormatMapperProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Analysis results
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [skipRows, setSkipRows] = useState(0)

  // Column mappings
  const [dateColumn, setDateColumn] = useState<string>('')
  const [amountColumn, setAmountColumn] = useState<string>('')
  const [descriptionColumn, setDescriptionColumn] = useState<string>('')
  const [merchantColumn, setMerchantColumn] = useState<string>('')
  const [referenceColumn, setReferenceColumn] = useState<string>('')
  const [categoryColumn, setCategoryColumn] = useState<string>('')

  // Format settings
  const [dateFormat, setDateFormat] = useState('%m/%d/%Y')
  const [amountConvention, setAmountConvention] = useState('negative_prefix')
  const [amountPrefix, setAmountPrefix] = useState('')
  const [invertSign, setInvertSign] = useState(false)

  // Row handling
  const [skipFooterRows, setSkipFooterRows] = useState(0)
  const [skipPatterns, setSkipPatterns] = useState<string[]>([])
  const [newPattern, setNewPattern] = useState('')

  // Config metadata
  const [configName, setConfigName] = useState('')
  const [accountSource, setAccountSource] = useState('')

  // Preview results
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([])
  const [previewErrors, setPreviewErrors] = useState<string[]>([])

  // Saved configs
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([])
  const [showLoadConfig, setShowLoadConfig] = useState(false)

  // Analyze file when it changes or skip rows changes
  const analyzeFile = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('skip_rows', skipRows.toString())

      const res = await fetch('/api/v1/import/analyze', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('Failed to analyze file')
      }

      const data = await res.json()
      setAnalysis(data)

      // Auto-select columns based on hints
      for (const [header, hint] of Object.entries(data.column_hints)) {
        const h = hint as ColumnHint
        if (h.likely_type === 'date' && h.confidence >= 0.7 && !dateColumn) {
          setDateColumn(header)
          if (h.detected_format) {
            setDateFormat(h.detected_format)
          }
        } else if (h.likely_type === 'amount' && h.confidence >= 0.7 && !amountColumn) {
          setAmountColumn(header)
          if (h.detected_settings) {
            setAmountConvention(h.detected_settings.sign_convention)
            setAmountPrefix(h.detected_settings.currency_prefix)
          }
        } else if (h.likely_type === 'description' && h.confidence >= 0.6 && !descriptionColumn) {
          setDescriptionColumn(header)
        } else if (h.likely_type === 'reference' && h.confidence >= 0.5 && !referenceColumn) {
          setReferenceColumn(header)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze file')
    } finally {
      setLoading(false)
    }
  }, [file, skipRows, dateColumn, amountColumn, descriptionColumn, referenceColumn])

  useEffect(() => {
    analyzeFile()
  }, [analyzeFile])

  // Load saved configs
  useEffect(() => {
    async function loadConfigs() {
      try {
        const res = await fetch('/api/v1/import/custom/configs')
        if (res.ok) {
          const data = await res.json()
          setSavedConfigs(data)
        }
      } catch (err) {
        console.error('Error loading saved configs:', err)
      }
    }
    loadConfigs()
  }, [])

  const handleLoadConfig = (config: SavedConfig) => {
    try {
      const parsed = JSON.parse(config.config_json)
      setConfigName(parsed.name || config.name)
      setAccountSource(parsed.account_source || '')
      setDateColumn(parsed.date_column?.toString() || '')
      setAmountColumn(parsed.amount_column?.toString() || '')
      setDescriptionColumn(parsed.description_column?.toString() || '')
      setMerchantColumn(parsed.merchant_column?.toString() || '')
      setReferenceColumn(parsed.reference_column?.toString() || '')
      setCategoryColumn(parsed.category_column?.toString() || '')
      setDateFormat(parsed.date_format || '%m/%d/%Y')
      setAmountConvention(parsed.amount_sign_convention || 'negative_prefix')
      setAmountPrefix(parsed.amount_currency_prefix || '')
      setInvertSign(parsed.amount_invert_sign || false)
      if (parsed.row_handling) {
        setSkipRows(parsed.row_handling.skip_header_rows || 0)
        setSkipFooterRows(parsed.row_handling.skip_footer_rows || 0)
        setSkipPatterns(parsed.row_handling.skip_patterns || [])
      }
      setShowLoadConfig(false)
      setStep(2) // Go to column mapping step
    } catch (err) {
      setError('Failed to load configuration')
    }
  }

  const buildConfig = (): CustomConfig => {
    return {
      name: configName || `${file.name} Format`,
      account_source: accountSource,
      date_column: dateColumn,
      amount_column: amountColumn,
      description_column: descriptionColumn,
      merchant_column: merchantColumn || undefined,
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
        skip_patterns: skipPatterns,
        skip_empty_rows: true,
      },
      merchant_split_chars: '',
      merchant_max_length: 50,
    }
  }

  const handlePreview = async () => {
    setLoading(true)
    setError(null)
    setPreviewErrors([])

    try {
      const config = buildConfig()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('config_json', JSON.stringify(config))

      const res = await fetch('/api/v1/import/custom/preview', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to preview')
      }

      setPreviewTransactions(data.transactions || [])
      setPreviewErrors(data.errors || [])
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    const config = buildConfig()
    onConfigured(config)
  }

  const addSkipPattern = () => {
    if (newPattern.trim() && !skipPatterns.includes(newPattern.trim())) {
      setSkipPatterns([...skipPatterns, newPattern.trim()])
      setNewPattern('')
    }
  }

  const removeSkipPattern = (pattern: string) => {
    setSkipPatterns(skipPatterns.filter(p => p !== pattern))
  }

  const canProceedToStep2 = analysis && analysis.headers.length > 0
  const canProceedToStep3 = dateColumn && amountColumn && descriptionColumn
  const canProceedToStep4 = canProceedToStep3 && accountSource

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-semibold">Configure Custom CSV Format</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s ? 'bg-blue-600 text-white' :
                  step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <span className={`ml-2 text-sm ${step === s ? 'font-medium' : 'text-gray-500'}`}>
                  {s === 1 ? 'Analyze' : s === 2 ? 'Map Columns' : s === 3 ? 'Settings' : 'Preview'}
                </span>
                {s < 4 && <div className="w-8 h-0.5 mx-2 bg-gray-300" />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
              {error}
            </div>
          )}

          {/* Step 1: Analyze */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium">File Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Analyzing: <span className="font-mono">{file.name}</span>
                  </p>
                </div>
                {savedConfigs.length > 0 && (
                  <button
                    onClick={() => setShowLoadConfig(!showLoadConfig)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Load saved config
                  </button>
                )}
              </div>

              {showLoadConfig && savedConfigs.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Saved Configurations:</p>
                  {savedConfigs.map((cfg) => (
                    <button
                      key={cfg.id}
                      onClick={() => handleLoadConfig(cfg)}
                      className="block w-full text-left px-3 py-2 bg-white rounded border hover:bg-gray-50"
                    >
                      <span className="font-medium">{cfg.name}</span>
                      {cfg.description && (
                        <span className="text-sm text-gray-500 ml-2">{cfg.description}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Skip Header Rows
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Number of rows before the column header (metadata, account info, etc.)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={skipRows}
                    onChange={(e) => setSkipRows(parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 border rounded-md"
                  />
                  <button
                    onClick={() => analyzeFile()}
                    disabled={loading}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
                  >
                    Re-analyze
                  </button>
                </div>
              </div>

              {loading && (
                <div className="text-center py-8 text-gray-500">
                  Analyzing file...
                </div>
              )}

              {analysis && !loading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      <strong>{analysis.headers.length}</strong> columns detected
                    </span>
                    <span className="text-gray-600">
                      <strong>{analysis.row_count}</strong> data rows
                    </span>
                  </div>

                  {/* Column hints */}
                  <div>
                    <p className="text-sm font-medium mb-2">Detected Columns:</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.headers.map((header) => {
                        const hint = analysis.column_hints[header]
                        const typeColor =
                          hint?.likely_type === 'date' ? 'bg-purple-100 text-purple-800' :
                          hint?.likely_type === 'amount' ? 'bg-green-100 text-green-800' :
                          hint?.likely_type === 'description' ? 'bg-blue-100 text-blue-800' :
                          hint?.likely_type === 'reference' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'

                        return (
                          <span
                            key={header}
                            className={`px-2 py-1 rounded text-xs ${typeColor}`}
                            title={hint?.likely_type !== 'unknown'
                              ? `Detected as: ${hint.likely_type} (${Math.round(hint.confidence * 100)}% confidence)`
                              : 'Unknown type'}
                          >
                            {header}
                            {hint?.likely_type !== 'unknown' && (
                              <span className="ml-1 opacity-70">({hint.likely_type})</span>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  {/* Sample data preview */}
                  <div>
                    <p className="text-sm font-medium mb-2">Sample Data:</p>
                    <div className="overflow-x-auto border rounded">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {analysis.headers.map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.sample_rows.slice(0, 3).map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 border-b truncate max-w-[200px]">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && analysis && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Map Columns to Fields</h3>
                <p className="text-sm text-gray-600">Select which CSV column contains each field.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Column <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={dateColumn}
                    onChange={(e) => setDateColumn(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md ${!dateColumn ? 'border-yellow-400' : ''}`}
                  >
                    <option value="">-- Select --</option>
                    {analysis.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Column <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={amountColumn}
                    onChange={(e) => setAmountColumn(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md ${!amountColumn ? 'border-yellow-400' : ''}`}
                  >
                    <option value="">-- Select --</option>
                    {analysis.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description Column <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={descriptionColumn}
                    onChange={(e) => setDescriptionColumn(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md ${!descriptionColumn ? 'border-yellow-400' : ''}`}
                  >
                    <option value="">-- Select --</option>
                    {analysis.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Merchant Column <span className="text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={merchantColumn}
                    onChange={(e) => setMerchantColumn(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">-- None (extract from description) --</option>
                    {analysis.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference/ID Column <span className="text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={referenceColumn}
                    onChange={(e) => setReferenceColumn(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">-- None --</option>
                    {analysis.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Column <span className="text-gray-400">(optional)</span>
                  </label>
                  <select
                    value={categoryColumn}
                    onChange={(e) => setCategoryColumn(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">-- None --</option>
                    {analysis.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Format Settings */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Format Settings</h3>
                <p className="text-sm text-gray-600">Configure how dates and amounts are parsed.</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Date Format */}
                <div className="space-y-4">
                  <h4 className="font-medium">Date Format</h4>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    {DATE_FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                {/* Amount Format */}
                <div className="space-y-4">
                  <h4 className="font-medium">Amount Format</h4>
                  <select
                    value={amountConvention}
                    onChange={(e) => setAmountConvention(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    {AMOUNT_CONVENTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Currency Prefix</label>
                    <input
                      type="text"
                      value={amountPrefix}
                      onChange={(e) => setAmountPrefix(e.target.value)}
                      placeholder="e.g., $"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={invertSign}
                      onChange={(e) => setInvertSign(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">
                      Invert sign (for credit card statements where positive = expense)
                    </span>
                  </label>
                </div>
              </div>

              {/* Row Handling */}
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium">Row Handling</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Skip Footer Rows</label>
                    <input
                      type="number"
                      min="0"
                      value={skipFooterRows}
                      onChange={(e) => setSkipFooterRows(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">Rows to skip at end (totals, etc.)</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Skip Rows Containing</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPattern}
                      onChange={(e) => setNewPattern(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSkipPattern()}
                      placeholder="e.g., PENDING, BALANCE"
                      className="flex-1 px-3 py-2 border rounded-md"
                    />
                    <button
                      onClick={addSkipPattern}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md"
                    >
                      Add
                    </button>
                  </div>
                  {skipPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {skipPatterns.map((p) => (
                        <span key={p} className="px-2 py-1 bg-gray-100 rounded text-sm flex items-center gap-1">
                          {p}
                          <button onClick={() => removeSkipPattern(p)} className="text-gray-500 hover:text-red-500">
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Config Metadata */}
              <div className="border-t pt-6 space-y-4">
                <h4 className="font-medium">Configuration</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Configuration Name
                    </label>
                    <input
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder={`${file.name} Format`}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Account Source <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={accountSource}
                      onChange={(e) => setAccountSource(e.target.value)}
                      placeholder="e.g., Chase-Checking"
                      className={`w-full px-3 py-2 border rounded-md ${!accountSource ? 'border-yellow-400' : ''}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Preview Results</h3>
                <p className="text-sm text-gray-600">
                  {previewTransactions.length} transactions parsed successfully
                </p>
              </div>

              {previewErrors.length > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-medium text-yellow-800">Warnings:</p>
                  <ul className="list-disc list-inside text-sm text-yellow-700">
                    {previewErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {previewTransactions.length > 0 && (
                <div className="border rounded overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Merchant</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewTransactions.slice(0, 10).map((txn, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2">{txn.date}</td>
                          <td className="px-4 py-2">{txn.merchant}</td>
                          <td className="px-4 py-2 truncate max-w-[200px]">{txn.description}</td>
                          <td className={`px-4 py-2 text-right ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(txn.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewTransactions.length > 10 && (
                    <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
                      Showing first 10 of {previewTransactions.length} transactions
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded">
                <p className="font-medium">Configuration Summary:</p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>Name: {configName || `${file.name} Format`}</li>
                  <li>Account: {accountSource}</li>
                  <li>Date format: {DATE_FORMATS.find(f => f.value === dateFormat)?.label}</li>
                  <li>Amount format: {AMOUNT_CONVENTIONS.find(f => f.value === amountConvention)?.label}</li>
                  {invertSign && <li>Sign inverted</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between">
          <button
            onClick={step === 1 ? onCancel : () => setStep(step - 1)}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex gap-2">
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2 || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Map Columns
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedToStep3}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Settings
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handlePreview}
                disabled={!canProceedToStep4 || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Preview Import'}
              </button>
            )}
            {step === 4 && (
              <button
                onClick={handleConfirm}
                disabled={previewTransactions.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Use This Configuration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
