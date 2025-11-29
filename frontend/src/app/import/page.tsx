'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/format'
import { PageHelp } from '@/components/PageHelp'

const FORMAT_NAMES: Record<string, string> = {
  'bofa_bank': 'Bank of America (Checking/Savings)',
  'bofa_cc': 'Bank of America (Credit Card)',
  'amex_cc': 'American Express',
  'unknown': 'Unknown'
}

interface FilePreview {
  filename: string
  account_source: string | null
  detected_format: string
  transaction_count: number
  duplicate_count: number
  cross_file_duplicate_count: number
  total_amount: number
  date_range_start: string | null
  date_range_end: string | null
  transactions: any[]
  selected: boolean
  accountSourceOverride?: string
}

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [batchPreviews, setBatchPreviews] = useState<FilePreview[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Legacy single file mode states (kept for backwards compatibility)
  const [file, setFile] = useState<File | null>(null)
  const [accountSource, setAccountSource] = useState('')
  const [formatHint, setFormatHint] = useState('')
  const [preview, setPreview] = useState<any>(null)

  async function handlePreview() {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    if (accountSource) formData.append('account_source', accountSource)
    if (formatHint) formData.append('format_hint', formatHint)

    try {
      const res = await fetch('/api/v1/import/preview', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setPreview(data)
      setResult(null)
    } catch (error) {
      console.error('Error previewing import:', error)
      alert('Error previewing file')
    }
  }

  async function handleConfirm() {
    if (!file || !preview) return

    setImporting(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('format_type', preview.detected_format)
    if (accountSource) formData.append('account_source', accountSource)
    formData.append('save_format', 'true')

    try {
      const res = await fetch('/api/v1/import/confirm', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setResult(data)
      setPreview(null)
      setFile(null)
      setAccountSource('')
    } catch (error) {
      console.error('Error importing:', error)
      alert('Error importing transactions')
    } finally {
      setImporting(false)
    }
  }

  async function handleBatchPreview() {
    if (files.length === 0) return

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })

    try {
      const res = await fetch('/api/v1/import/batch/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      // Mark all files as selected by default
      const previews = data.files.map((filePreview: any) => ({
        ...filePreview,
        selected: true
      }))

      setBatchPreviews(previews)
      setResult(null)
    } catch (error) {
      console.error('Error previewing batch import:', error)
      alert('Error previewing batch import')
    }
  }

  async function handleBatchConfirm() {
    const selectedFiles = batchPreviews.filter(p => p.selected)
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to import')
      return
    }

    setImporting(true)

    try {
      // Build the request payload
      const requestBody = {
        files: selectedFiles.map(preview => ({
          filename: preview.filename,
          account_source: preview.accountSourceOverride || preview.account_source,
          format_type: preview.detected_format
        })),
        save_format: true
      }

      // Build form data with files and request JSON
      const formData = new FormData()

      // Add all selected files
      selectedFiles.forEach(preview => {
        const file = files.find(f => f.name === preview.filename)
        if (file) {
          formData.append('files', file)
        }
      })

      // Add the request JSON as a form field
      formData.append('request', JSON.stringify(requestBody))

      const res = await fetch('/api/v1/import/batch/confirm', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      setResult(data)
      setBatchPreviews([])
      setFiles([])
    } catch (error) {
      console.error('Error importing batch:', error)
      alert('Error importing batch')
    } finally {
      setImporting(false)
    }
  }

  function toggleFileSelection(filename: string) {
    setBatchPreviews(prevPreviews =>
      prevPreviews.map(p =>
        p.filename === filename ? { ...p, selected: !p.selected } : p
      )
    )
  }

  function updateAccountSource(filename: string, accountSource: string) {
    setBatchPreviews(prevPreviews =>
      prevPreviews.map(p =>
        p.filename === filename ? { ...p, accountSourceOverride: accountSource } : p
      )
    )
  }

  return (
    <div className="space-y-6">
      <PageHelp
        pageId="import"
        title="Import Help"
        description="Import transactions from your bank's CSV export files. Supported formats include Bank of America (checking and credit cards) and American Express."
        steps={[
          "Download a CSV export from your bank's website",
          "Select the file using the file picker below",
          "Optionally specify an account name to help organize your data",
          "Click 'Preview Import' to see what will be imported",
          "Review the preview, then click 'Confirm Import' to save"
        ]}
        tips={[
          "The system auto-detects your bank's CSV format",
          "Duplicate transactions are automatically skipped",
          "You can view and rollback imports from the Admin page"
        ]}
      />

      <h1 className="text-3xl font-bold text-theme">Import Transactions</h1>

      {/* Import Mode Toggle */}
      <div className="flex gap-4 bg-white rounded-lg shadow p-4">
        <button
          onClick={() => {
            setBatchMode(false)
            setBatchPreviews([])
            setFiles([])
          }}
          className={`flex-1 px-4 py-2 rounded-md ${!batchMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Single File Import
        </button>
        <button
          onClick={() => {
            setBatchMode(true)
            setPreview(null)
            setFile(null)
          }}
          className={`flex-1 px-4 py-2 rounded-md ${batchMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Batch Import (Multiple Files)
        </button>
      </div>

      {/* Batch Import UI */}
      {batchMode && (
        <>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV Files (Multiple)
              </label>
              <input
                type="file"
                accept=".csv"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {files.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            <button
              onClick={handleBatchPreview}
              disabled={files.length === 0}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Preview Batch Import
            </button>
          </div>

          {/* Batch Previews */}
          {batchPreviews.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Batch Import Preview</h2>
                <div className="text-sm text-gray-600">
                  {batchPreviews.filter(p => p.selected).length} of {batchPreviews.length} files selected
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
                <div>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                  <p className="text-2xl font-bold">
                    {batchPreviews.filter(p => p.selected).reduce((sum, p) => sum + p.transaction_count, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Duplicates</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {batchPreviews.filter(p => p.selected).reduce((sum, p) => sum + p.duplicate_count + p.cross_file_duplicate_count, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Net Amount</p>
                  <p className={`text-2xl font-bold ${batchPreviews.filter(p => p.selected).reduce((sum, p) => sum + p.total_amount, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(batchPreviews.filter(p => p.selected).reduce((sum, p) => sum + p.total_amount, 0))}
                  </p>
                </div>
              </div>

              {/* File List */}
              <div className="space-y-4">
                {batchPreviews.map((filePreview) => (
                  <div key={filePreview.filename} className={`border rounded-lg p-4 ${filePreview.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={filePreview.selected}
                        onChange={() => toggleFileSelection(filePreview.filename)}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg">{filePreview.filename}</h3>
                            <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                              {FORMAT_NAMES[filePreview.detected_format] || filePreview.detected_format}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-3 text-sm">
                          <div>
                            <p className="text-gray-600">Transactions</p>
                            <p className="font-semibold">{filePreview.transaction_count}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">DB Duplicates</p>
                            <p className="font-semibold text-yellow-600">{filePreview.duplicate_count}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Batch Duplicates</p>
                            <p className="font-semibold text-orange-600">{filePreview.cross_file_duplicate_count}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Date Range</p>
                            <p className="font-semibold">
                              {filePreview.date_range_start && filePreview.date_range_end
                                ? `${format(new Date(filePreview.date_range_start), 'MM/dd/yy')} - ${format(new Date(filePreview.date_range_end), 'MM/dd/yy')}`
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Total Amount</p>
                            <p className={`font-semibold ${filePreview.total_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(filePreview.total_amount)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Account Source (Optional)</label>
                          <input
                            type="text"
                            value={filePreview.accountSourceOverride || filePreview.account_source || ''}
                            onChange={(e) => updateAccountSource(filePreview.filename, e.target.value)}
                            placeholder="e.g., BOFA-Checking"
                            className="w-full px-3 py-1 text-sm border rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleBatchConfirm}
                  disabled={importing || batchPreviews.filter(p => p.selected).length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importing...' : `Import ${batchPreviews.filter(p => p.selected).length} Selected File${batchPreviews.filter(p => p.selected).length !== 1 ? 's' : ''}`}
                </button>
                <button
                  onClick={() => setBatchPreviews([])}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Single File Import UI */}
      {!batchMode && (
        <>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Source (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., BOFA-Checking, AMEX-53004"
              value={accountSource}
              onChange={(e) => setAccountSource(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            />
            <p className="mt-1 text-xs text-gray-500">
              Required for Bank of America files
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format Hint (Optional)
            </label>
            <select
              value={formatHint}
              onChange={(e) => setFormatHint(e.target.value)}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="">Auto-detect</option>
              <option value="bofa_bank">Bank of America (Checking/Savings)</option>
              <option value="bofa_cc">Bank of America (Credit Card)</option>
              <option value="amex_cc">American Express</option>
            </select>
          </div>
        </div>

            <button
              onClick={handlePreview}
              disabled={!file}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Preview Import
            </button>
          </div>

          {/* Preview */}
          {preview && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Preview</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {FORMAT_NAMES[preview.detected_format] || preview.detected_format} format detected
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
            <div>
              <p className="text-sm text-gray-600">Transactions</p>
              <p className="text-2xl font-bold">{preview.transaction_count}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className={`text-2xl font-bold ${preview.total_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(preview.total_amount)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Merchant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bucket</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {preview.transactions.slice(0, 10).map((txn: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm">{format(new Date(txn.date), 'MM/dd/yyyy')}</td>
                    <td className="px-4 py-2 text-sm">{txn.merchant}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">{txn.bucket || 'No Bucket'}</span>
                    </td>
                    <td className={`px-4 py-2 text-sm text-right ${txn.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(txn.amount, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.transactions.length > 10 && (
              <p className="text-center text-sm text-gray-500 mt-4">
                Showing first 10 of {preview.transaction_count} transactions
              </p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleConfirm}
              disabled={importing}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Confirm Import'}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-green-900">Import Complete!</h2>

          {/* Summary stats for both single and batch */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-green-700">Imported</p>
              <p className="text-2xl font-bold text-green-900">
                {result.total_imported || result.imported}
              </p>
            </div>
            <div>
              <p className="text-sm text-green-700">Duplicates Skipped</p>
              <p className="text-2xl font-bold text-green-900">
                {result.total_duplicates || result.duplicates}
              </p>
            </div>
            <div>
              <p className="text-sm text-green-700">
                {result.files ? 'Files Imported' : 'Format Saved'}
              </p>
              <p className="text-2xl font-bold text-green-900">
                {result.files ? result.files.length : (result.format_saved ? 'Yes' : 'No')}
              </p>
            </div>
          </div>

          {/* Per-file results for batch imports */}
          {result.files && result.files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-green-900">File Details:</h3>
              <div className="space-y-2">
                {result.files.map((file: any) => (
                  <div key={file.filename} className="bg-white rounded p-3 flex justify-between items-center">
                    <span className="font-medium">{file.filename}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-700">{file.imported} imported</span>
                      <span className="text-yellow-700">{file.duplicates} duplicates</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
