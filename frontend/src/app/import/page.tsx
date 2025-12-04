'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'
import { CustomFormatMapper } from '@/components/CustomFormatMapper'

interface AccountTag {
  id: number
  namespace: string
  value: string
}

const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'Bank of America (Checking/Savings)',
  'bofa_cc': 'Bank of America (Credit Card)',
  'amex_cc': 'American Express',
  'inspira_hsa': 'Inspira HSA',
  'venmo': 'Venmo',
  'custom': 'Custom Format',
  'unknown': 'Unknown Format'
}

interface AnalysisResult {
  headers: string[]
  sample_rows: string[][]
  column_hints: Record<string, {
    likely_type: string
    confidence: number
    detected_format?: string
    detected_settings?: Record<string, any>
  }>
  detected_format?: string
  format_confidence?: number
}

interface PreviewTransaction {
  date: string
  merchant: string
  description: string
  amount: number
  bucket?: string
  account_source?: string
}

interface PreviewResult {
  detected_format: string
  transaction_count: number
  duplicate_count?: number
  total_amount: number
  transactions: PreviewTransaction[]
  errors?: string[]
}

// Wizard steps
type WizardStep = 'upload' | 'analyze' | 'configure' | 'preview' | 'complete'

export default function ImportPage() {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('upload')

  // File state
  const [file, setFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')

  // Analysis state
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  // Configuration state
  const [accounts, setAccounts] = useState<AccountTag[]>([])
  const [accountSource, setAccountSource] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('')
  const [customConfig, setCustomConfig] = useState<any>(null)
  const [showCustomMapper, setShowCustomMapper] = useState(false)

  // Preview state
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Fetch existing account tags on mount
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('/api/v1/tags?namespace=account')
        const data = await res.json()
        setAccounts(data)
      } catch (error) {
        console.error('Error fetching accounts:', error)
      }
    }
    fetchAccounts()
  }, [])

  // Read file content when file changes
  useEffect(() => {
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFileContent(e.target?.result as string || '')
      }
      reader.readAsText(file)
    } else {
      setFileContent('')
    }
  }, [file])

  // Step 1 -> 2: Analyze file
  const handleAnalyze = useCallback(async () => {
    if (!file) return

    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/v1/import/analyze', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      setAnalysis(data)

      // Auto-select format if detected with high confidence
      if (data.detected_format && data.format_confidence > 0.8) {
        setSelectedFormat(data.detected_format)
      } else {
        setSelectedFormat('')
      }

      setStep('analyze')
    } catch (error) {
      console.error('Error analyzing file:', error)
      alert('Error analyzing file')
    } finally {
      setAnalyzing(false)
    }
  }, [file])

  // Step 2 -> 3: Proceed to configure
  const handleProceedToConfigure = () => {
    // If unknown format and no custom config, need to configure
    if (!selectedFormat && !customConfig) {
      setShowCustomMapper(true)
    } else {
      setStep('configure')
    }
  }

  // Step 3 -> 4: Generate preview
  const handlePreview = useCallback(async () => {
    if (!file || !accountSource) return

    setLoadingPreview(true)
    try {
      // Use custom format endpoint if custom config is set
      if (customConfig) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('config_json', JSON.stringify({
          ...customConfig,
          account_source: accountSource
        }))

        const res = await fetch('/api/v1/import/custom/preview', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()

        setPreview({
          detected_format: 'custom',
          transaction_count: data.transaction_count,
          total_amount: data.total_amount,
          transactions: data.transactions,
          errors: data.errors
        })
      } else {
        // Standard format preview
        const formData = new FormData()
        formData.append('file', file)
        formData.append('account_source', accountSource)
        if (selectedFormat) formData.append('format_hint', selectedFormat)

        const res = await fetch('/api/v1/import/preview', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        setPreview(data)
      }

      setStep('preview')
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Error generating preview')
    } finally {
      setLoadingPreview(false)
    }
  }, [file, accountSource, selectedFormat, customConfig])

  // Step 4 -> 5: Confirm import
  const handleConfirm = useCallback(async () => {
    if (!file || !preview || !accountSource) return

    setImporting(true)
    try {
      // Use custom confirm endpoint if custom config
      if (customConfig) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('config_json', JSON.stringify({
          ...customConfig,
          account_source: accountSource
        }))
        formData.append('save_config', 'true')

        const res = await fetch('/api/v1/import/custom/confirm', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        setResult(data)
      } else {
        // Standard confirm
        const formData = new FormData()
        formData.append('file', file)
        formData.append('format_type', preview.detected_format)
        formData.append('account_source', accountSource)
        formData.append('save_format', 'true')

        const res = await fetch('/api/v1/import/confirm', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        setResult(data)
      }

      setStep('complete')
    } catch (error) {
      console.error('Error importing:', error)
      alert('Error importing transactions')
    } finally {
      setImporting(false)
    }
  }, [file, preview, accountSource, customConfig])

  // Reset to start over
  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setFileContent('')
    setAnalysis(null)
    setAccountSource('')
    setSelectedFormat('')
    setCustomConfig(null)
    setPreview(null)
    setResult(null)
  }

  // Go back one step
  const handleBack = () => {
    switch (step) {
      case 'analyze':
        setStep('upload')
        break
      case 'configure':
        setStep('analyze')
        break
      case 'preview':
        setStep('configure')
        break
    }
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="import"
        title="Import Help"
        description="Import transactions from your bank's CSV export files. The wizard will guide you through analyzing, configuring, and importing your data."
        steps={[
          "Upload your CSV file",
          "Review the auto-detected format or configure custom mappings",
          "Confirm your account source",
          "Preview the parsed transactions",
          "Import and you're done!"
        ]}
        tips={[
          "The system auto-detects common bank formats",
          "For unknown formats, use the custom format mapper",
          "Duplicate transactions are automatically skipped"
        ]}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-theme">Import Transactions</h1>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          {(['upload', 'analyze', 'configure', 'preview', 'complete'] as WizardStep[]).map((s, idx) => {
            const stepLabels = {
              'upload': '1. Upload',
              'analyze': '2. Analyze',
              'configure': '3. Configure',
              'preview': '4. Preview',
              'complete': '5. Complete'
            }
            const currentIdx = ['upload', 'analyze', 'configure', 'preview', 'complete'].indexOf(step)
            const isActive = s === step
            const isComplete = idx < currentIdx

            return (
              <div key={s} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                  ${isActive ? 'bg-blue-600 text-white' : isComplete ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}
                `}>
                  {isComplete ? '✓' : idx + 1}
                </div>
                <span className={`ml-2 text-sm ${isActive ? 'font-semibold text-blue-600' : 'text-gray-500'}`}>
                  {stepLabels[s].split('. ')[1]}
                </span>
                {idx < 4 && (
                  <div className={`w-12 h-0.5 mx-2 ${idx < currentIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold">Upload CSV File</h2>
          <p className="text-gray-600">
            Select a CSV file exported from your bank or financial institution.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="mt-2 text-sm">Click to select a file or drag and drop</p>
                <p className="mt-1 text-xs text-gray-400">CSV files only</p>
              </div>
            </label>
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-blue-600">📄</span>
                <span className="font-medium">{file.name}</span>
                <span className="text-sm text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!file || analyzing}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {analyzing ? 'Analyzing...' : 'Analyze File →'}
          </button>
        </div>
      )}

      {/* Step 2: Analyze */}
      {step === 'analyze' && analysis && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold">Analysis Results</h2>
              <p className="text-gray-600 mt-1">Review what we found in your file.</p>
            </div>
            {analysis.detected_format && analysis.format_confidence && analysis.format_confidence > 0.5 && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                analysis.format_confidence > 0.8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {analysis.format_confidence > 0.8 ? '✓' : '?'} {FORMAT_NAMES[analysis.detected_format] || analysis.detected_format}
              </div>
            )}
          </div>

          {/* Column Analysis */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Detected Columns ({analysis.headers.length})</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.headers.map((header) => {
                const hint = analysis.column_hints[header]
                const typeColors: Record<string, string> = {
                  'date': 'bg-purple-100 text-purple-800',
                  'amount': 'bg-green-100 text-green-800',
                  'description': 'bg-blue-100 text-blue-800',
                  'reference': 'bg-gray-100 text-gray-800',
                  'unknown': 'bg-gray-50 text-gray-600'
                }
                return (
                  <div
                    key={header}
                    className={`px-3 py-1 rounded-full text-sm ${typeColors[hint?.likely_type] || typeColors['unknown']}`}
                  >
                    {header}
                    {hint?.likely_type !== 'unknown' && (
                      <span className="ml-1 opacity-75">({hint?.likely_type})</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sample Data */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Sample Data</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {analysis.headers.map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analysis.sample_rows.slice(0, 3).map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-3 py-2 whitespace-nowrap text-gray-600">
                          {cell.substring(0, 40)}{cell.length > 40 ? '...' : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Format</h3>
            {analysis.detected_format && analysis.format_confidence && analysis.format_confidence > 0.8 ? (
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-green-800">
                  <span className="font-medium">Auto-detected:</span> {FORMAT_NAMES[analysis.detected_format]}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  We recognized this file format. Click Continue to proceed.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                  We couldn't confidently detect the format. Please select one or configure a custom format.
                </p>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                >
                  <option value="">-- Select a format --</option>
                  <option value="bofa_bank">Bank of America (Checking/Savings)</option>
                  <option value="bofa_cc">Bank of America (Credit Card)</option>
                  <option value="amex_cc">American Express</option>
                  <option value="inspira_hsa">Inspira HSA</option>
                  <option value="venmo">Venmo</option>
                </select>
                <button
                  onClick={() => setShowCustomMapper(true)}
                  className="w-full px-4 py-2 border-2 border-purple-300 text-purple-700 rounded-md hover:bg-purple-50"
                >
                  Configure Custom Format
                </button>
              </div>
            )}
          </div>

          {/* Custom config indicator */}
          {customConfig && (
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-purple-800 font-medium">Custom Format Configured</p>
                  <p className="text-sm text-purple-600">{customConfig.name}</p>
                </div>
                <button
                  onClick={() => setShowCustomMapper(true)}
                  className="text-sm text-purple-700 hover:text-purple-900"
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              ← Back
            </button>
            <button
              onClick={handleProceedToConfigure}
              disabled={!selectedFormat && !customConfig}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Configure */}
      {step === 'configure' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <h2 className="text-xl font-semibold">Configure Import</h2>

          <div className="space-y-4">
            {/* Format Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Format</p>
              <p className="font-medium">
                {customConfig ? customConfig.name : FORMAT_NAMES[selectedFormat] || selectedFormat}
              </p>
            </div>

            {/* Account Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Source <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-500 mb-2">
                This helps track where transactions came from and detect duplicates.
              </p>
              {accounts.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={accountSource}
                    onChange={(e) => setAccountSource(e.target.value)}
                    className="w-full px-4 py-2 border rounded-md"
                  >
                    <option value="">-- Select existing account --</option>
                    {accounts.map((acct) => (
                      <option key={acct.id} value={acct.value}>
                        {acct.value}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">or</span>
                    <input
                      type="text"
                      placeholder="Create new account name"
                      value={accounts.some(a => a.value === accountSource) ? '' : accountSource}
                      onChange={(e) => setAccountSource(e.target.value)}
                      className="flex-1 px-4 py-2 border rounded-md"
                    />
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="e.g., BOFA-Checking, AMEX-Platinum"
                  value={accountSource}
                  onChange={(e) => setAccountSource(e.target.value)}
                  className="w-full px-4 py-2 border rounded-md"
                />
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              ← Back
            </button>
            <button
              onClick={handlePreview}
              disabled={!accountSource || loadingPreview}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {loadingPreview ? 'Loading Preview...' : 'Preview Transactions →'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 'preview' && preview && (
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Preview Transactions</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {customConfig ? customConfig.name : FORMAT_NAMES[preview.detected_format] || preview.detected_format}
            </span>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Transactions</p>
              <p className="text-2xl font-bold">{preview.transaction_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Duplicates</p>
              <p className="text-2xl font-bold text-yellow-600">{preview.duplicate_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className={`text-2xl font-bold ${preview.total_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(preview.total_amount)}
              </p>
            </div>
          </div>

          {/* Errors */}
          {preview.errors && preview.errors.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">Parsing Errors</h3>
              <ul className="list-disc list-inside text-sm text-red-600">
                {preview.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Transaction Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.transactions.slice(0, 15).map((txn, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-sm whitespace-nowrap">
                      {format(new Date(txn.date), 'MM/dd/yyyy')}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium">{txn.merchant}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">
                      {txn.description}
                    </td>
                    <td className={`px-4 py-2 text-sm text-right font-medium ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(txn.amount, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.transactions.length > 15 && (
              <p className="text-center text-sm text-gray-500 mt-4 py-2 bg-gray-50">
                Showing first 15 of {preview.transaction_count} transactions
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-4 pt-4 border-t">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              ← Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={importing || preview.transaction_count === 0}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {importing ? 'Importing...' : `Import ${preview.transaction_count - (preview.duplicate_count || 0)} Transactions ✓`}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-green-900">Import Complete!</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-gray-600">Imported</p>
              <p className="text-3xl font-bold text-green-700">
                {result.imported || result.total_imported || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-gray-600">Duplicates Skipped</p>
              <p className="text-3xl font-bold text-yellow-600">
                {result.duplicates || result.total_duplicates || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-sm text-gray-600">Format Saved</p>
              <p className="text-3xl font-bold text-blue-600">
                {result.format_saved || result.config_saved ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {/* Cross-account warnings */}
          {result.cross_account_warning_count > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">
                Cross-Account Matches ({result.cross_account_warning_count})
              </h3>
              <p className="text-sm text-yellow-700">
                Some transactions match entries in other accounts. This could indicate transfers.
              </p>
            </div>
          )}

          <button
            onClick={handleReset}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Import Another File
          </button>
        </div>
      )}

      {/* Custom Format Mapper Modal */}
      {showCustomMapper && file && (
        <CustomFormatMapper
          file={file}
          onConfigured={(config) => {
            setCustomConfig(config)
            setSelectedFormat('')
            setShowCustomMapper(false)
            // If we're on analyze step, auto-proceed to configure
            if (step === 'analyze') {
              setStep('configure')
            }
          }}
          onCancel={() => setShowCustomMapper(false)}
        />
      )}
    </div>
  )
}
